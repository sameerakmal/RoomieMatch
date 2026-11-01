import type { RequestHandler } from 'express';
import mongoose from 'mongoose';
import { Connection, generatePairKey, type ConnectionDocument } from '../models/Connection.js';
import { Notification } from '../models/Notification.js';
import { User, type UserDocument } from '../models/User.js';
import { RoommatePreferences } from '../models/RoommatePreferences.js';
import { calculateCompatibility } from '../services/matching/matchingEngine.js';
import { toSafeProfile } from './matchingController.js';
import { revokeConnectionConversations } from '../realtime/socketServer.js';
import { HttpError } from '../utils/HttpError.js';

function formatEnumLabel(val: string | undefined): string {
  if (!val) return '';
  return val
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

function isValidObjectId(id: unknown): id is string {
  return typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);
}

function formatConnectionBasic(conn: ConnectionDocument, currentUserId: mongoose.Types.ObjectId) {
  const isSender = conn.sender.equals(currentUserId);
  return {
    id: conn._id.toString(),
    senderId: conn.sender.toString(),
    recipientId: conn.recipient.toString(),
    status: conn.status,
    message: conn.message,
    respondedAt: conn.respondedAt ? conn.respondedAt.toISOString() : null,
    createdAt: conn.createdAt.toISOString(),
    updatedAt: conn.updatedAt.toISOString(),
    isSender,
  };
}

export const sendRequest: RequestHandler = async (request, response) => {
  const currentUserId = request.user!._id;
  const recipientParam = Array.isArray(request.params.userId) ? request.params.userId[0] : request.params.userId;

  if (!isValidObjectId(recipientParam)) {
    throw new HttpError(400, 'Invalid user ID format.');
  }

  const recipientId = new mongoose.Types.ObjectId(recipientParam);

  if (currentUserId.equals(recipientId)) {
    throw new HttpError(400, 'Cannot send a connection request to yourself.');
  }

  // Verify recipient exists
  const recipientUser = await User.findById(recipientId);
  if (!recipientUser) {
    throw new HttpError(404, 'User not found.');
  }

  // Verify sender has completed preferences
  const senderPreferences = await RoommatePreferences.findOne({ userId: currentUserId });
  if (!senderPreferences || !senderPreferences.isCompleted) {
    throw new HttpError(
      400,
      'Please complete your roommate preferences questionnaire before sending connection requests.',
      { code: 'PREFERENCES_INCOMPLETE' },
    );
  }

  // Verify recipient has completed preferences
  const recipientPreferences = await RoommatePreferences.findOne({ userId: recipientId });
  if (!recipientPreferences || !recipientPreferences.isCompleted) {
    throw new HttpError(400, 'Candidate has not completed their roommate preferences.');
  }

  // Verify eligibility (hard constraints)
  const compatibility = calculateCompatibility(senderPreferences, recipientPreferences);
  if (!compatibility.isEligible) {
    throw new HttpError(400, 'Connection request cannot be sent due to mutual living requirement constraints.');
  }

  // Check existing connection between the pair
  const pairKey = generatePairKey(currentUserId, recipientId);
  const existing = await Connection.findOne({
    pairKey,
    status: { $in: ['pending', 'accepted'] },
  });

  if (existing) {
    if (existing.status === 'accepted') {
      throw new HttpError(409, 'You are already connected with this user.');
    }
    if (existing.sender.equals(currentUserId)) {
      throw new HttpError(409, 'You have already sent a pending connection request to this user.');
    }
    if (existing.sender.equals(recipientId)) {
      throw new HttpError(
        409,
        'This roommate candidate has already sent you a connection request. Check your received requests to accept.',
      );
    }
  }

  // Validate optional introduction message
  let message = '';
  if (request.body && typeof request.body.message === 'string') {
    message = request.body.message.trim();
    if (message.length > 500) {
      throw new HttpError(400, 'Introduction message cannot exceed 500 characters.');
    }
  }

  try {
    const connection = await Connection.create({
      sender: currentUserId,
      recipient: recipientId,
      status: 'pending',
      message,
      pairKey,
    });

    // Create in-app notification for the recipient
    await Notification.create({
      recipient: recipientId,
      actor: currentUserId,
      type: 'connection_request',
      connectionId: connection._id,
    }).catch(() => {
      // Ignore duplicate notification index conflicts if any
    });

    response.status(201).json({
      connection: formatConnectionBasic(connection, currentUserId),
    });
  } catch (error: any) {
    if (error.code === 11000) {
      throw new HttpError(409, 'A connection request already exists between you and this user.');
    }
    throw error;
  }
};

export const getReceivedRequests: RequestHandler = async (request, response) => {
  const currentUserId = request.user!._id;
  const page = Math.max(1, parseInt(String(request.query.page || '1'), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(request.query.limit || '10'), 10) || 10));

  const query: mongoose.FilterQuery<any> = {
    recipient: currentUserId,
    status: 'pending',
  };

  const total = await Connection.countDocuments(query);
  const totalPages = Math.ceil(total / limit) || 1;
  const skip = (page - 1) * limit;

  const connections = await Connection.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate<{ sender: UserDocument }>('sender', 'name profile');

  // Load current user's preferences for compatibility calculation
  const currentUserPreferences = await RoommatePreferences.findOne({ userId: currentUserId });

  const items = await Promise.all(
    connections.map(async (conn) => {
      const senderUser = conn.sender;
      let compatibility = null;

      if (currentUserPreferences && currentUserPreferences.isCompleted && senderUser) {
        const senderPref = await RoommatePreferences.findOne({ userId: senderUser._id });
        if (senderPref && senderPref.isCompleted) {
          compatibility = calculateCompatibility(currentUserPreferences, senderPref);
        }
      }

      return {
        id: conn._id.toString(),
        sender: senderUser ? toSafeProfile(senderUser) : null,
        message: conn.message,
        status: conn.status,
        createdAt: conn.createdAt.toISOString(),
        compatibility: compatibility
          ? {
              overallScore: compatibility.overallScore,
              summary: compatibility.summary,
              strengths: compatibility.strengths,
            }
          : null,
      };
    }),
  );

  response.json({
    requests: items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  });
};

export const getSentRequests: RequestHandler = async (request, response) => {
  const currentUserId = request.user!._id;
  const page = Math.max(1, parseInt(String(request.query.page || '1'), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(request.query.limit || '10'), 10) || 10));

  const query: mongoose.FilterQuery<any> = {
    sender: currentUserId,
  };

  if (typeof request.query.status === 'string' && ['pending', 'accepted', 'rejected', 'cancelled'].includes(request.query.status)) {
    query.status = request.query.status;
  }

  const total = await Connection.countDocuments(query);
  const totalPages = Math.ceil(total / limit) || 1;
  const skip = (page - 1) * limit;

  const connections = await Connection.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate<{ recipient: UserDocument }>('recipient', 'name profile');

  const currentUserPreferences = await RoommatePreferences.findOne({ userId: currentUserId });

  const items = await Promise.all(
    connections.map(async (conn) => {
      const recipientUser = conn.recipient;
      let compatibility = null;

      if (currentUserPreferences && currentUserPreferences.isCompleted && recipientUser) {
        const recipientPref = await RoommatePreferences.findOne({ userId: recipientUser._id });
        if (recipientPref && recipientPref.isCompleted) {
          compatibility = calculateCompatibility(currentUserPreferences, recipientPref);
        }
      }

      return {
        id: conn._id.toString(),
        recipient: recipientUser ? toSafeProfile(recipientUser) : null,
        message: conn.message,
        status: conn.status,
        createdAt: conn.createdAt.toISOString(),
        respondedAt: conn.respondedAt ? conn.respondedAt.toISOString() : null,
        compatibility: compatibility
          ? {
              overallScore: compatibility.overallScore,
              summary: compatibility.summary,
              strengths: compatibility.strengths,
            }
          : null,
      };
    }),
  );

  response.json({
    requests: items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  });
};

export const acceptRequest: RequestHandler = async (request, response) => {
  const currentUserId = request.user!._id;
  const idParam = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;

  if (!isValidObjectId(idParam)) {
    throw new HttpError(400, 'Invalid connection request ID.');
  }

  const connection = await Connection.findById(idParam);
  if (!connection) {
    throw new HttpError(404, 'Connection request not found.');
  }

  // Authorization: Only the recipient can accept
  if (!connection.recipient.equals(currentUserId)) {
    if (connection.sender.equals(currentUserId)) {
      throw new HttpError(403, 'You cannot accept your own connection request.');
    }
    throw new HttpError(403, 'You are not authorized to accept this connection request.');
  }

  // Idempotent acceptance check
  if (connection.status === 'accepted') {
    return response.json({
      connection: formatConnectionBasic(connection, currentUserId),
      message: 'Connection request is already accepted.',
    });
  }

  // Prevent transitions from cancelled or rejected
  if (connection.status === 'rejected' || connection.status === 'cancelled') {
    throw new HttpError(400, `Cannot accept a connection request that has already been ${connection.status}.`);
  }

  // Transition from pending to accepted
  connection.status = 'accepted';
  connection.respondedAt = new Date();
  await connection.save();

  // Create notification for sender
  await Notification.create({
    recipient: connection.sender,
    actor: currentUserId,
    type: 'connection_accepted',
    connectionId: connection._id,
  }).catch(() => {});

  return response.json({
    connection: formatConnectionBasic(connection, currentUserId),
    message: 'Connection request accepted.',
  });
};

export const rejectRequest: RequestHandler = async (request, response) => {
  const currentUserId = request.user!._id;
  const idParam = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;

  if (!isValidObjectId(idParam)) {
    throw new HttpError(400, 'Invalid connection request ID.');
  }

  const connection = await Connection.findById(idParam);
  if (!connection) {
    throw new HttpError(404, 'Connection request not found.');
  }

  // Authorization: Only the recipient can reject
  if (!connection.recipient.equals(currentUserId)) {
    if (connection.sender.equals(currentUserId)) {
      throw new HttpError(403, 'You cannot reject your own connection request.');
    }
    throw new HttpError(403, 'You are not authorized to reject this connection request.');
  }

  // Idempotent rejection check
  if (connection.status === 'rejected') {
    return response.json({
      connection: formatConnectionBasic(connection, currentUserId),
      message: 'Connection request is already rejected.',
    });
  }

  // Prevent transitions from accepted or cancelled
  if (connection.status === 'accepted' || connection.status === 'cancelled') {
    throw new HttpError(400, `Cannot reject a connection request that has already been ${connection.status}.`);
  }

  // Transition from pending to rejected
  connection.status = 'rejected';
  connection.respondedAt = new Date();
  await connection.save();

  // Create notification for sender
  await Notification.create({
    recipient: connection.sender,
    actor: currentUserId,
    type: 'connection_rejected',
    connectionId: connection._id,
  }).catch(() => {});

  // After database status update succeeds, ensure any associated conversation is revoked
  await revokeConnectionConversations(connection._id);

  return response.json({
    connection: formatConnectionBasic(connection, currentUserId),
    message: 'Connection request rejected.',
  });
};

export const cancelRequest: RequestHandler = async (request, response) => {
  const currentUserId = request.user!._id;
  const idParam = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;

  if (!isValidObjectId(idParam)) {
    throw new HttpError(400, 'Invalid connection request ID.');
  }

  const connection = await Connection.findById(idParam);
  if (!connection) {
    throw new HttpError(404, 'Connection request not found.');
  }

  // Authorization: Only the sender can cancel
  if (!connection.sender.equals(currentUserId)) {
    if (connection.recipient.equals(currentUserId)) {
      throw new HttpError(403, 'You cannot cancel a connection request that you received.');
    }
    throw new HttpError(403, 'You are not authorized to cancel this connection request.');
  }

  // Idempotent cancellation check
  if (connection.status === 'cancelled') {
    return response.json({
      connection: formatConnectionBasic(connection, currentUserId),
      message: 'Connection request is already cancelled.',
    });
  }

  // Prevent transitions from accepted or rejected
  if (connection.status === 'accepted' || connection.status === 'rejected') {
    throw new HttpError(400, `Cannot cancel a connection request that has already been ${connection.status}.`);
  }

  connection.status = 'cancelled';
  connection.respondedAt = new Date();
  await connection.save();

  // After database status update succeeds, ensure any associated conversation is revoked
  await revokeConnectionConversations(connection._id);

  return response.json({
    connection: formatConnectionBasic(connection, currentUserId),
    message: 'Connection request cancelled.',
  });
};

export const disconnectConnection: RequestHandler = async (request, response) => {
  const currentUserId = request.user!._id;
  const idParam = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;

  if (!isValidObjectId(idParam)) {
    throw new HttpError(400, 'Invalid connection ID.');
  }

  const connection = await Connection.findById(idParam);
  if (!connection) {
    throw new HttpError(404, 'Connection not found.');
  }

  // Authorization: Either participant (sender or recipient) can terminate an accepted connection
  const isSender = connection.sender.equals(currentUserId);
  const isRecipient = connection.recipient.equals(currentUserId);
  if (!isSender && !isRecipient) {
    throw new HttpError(403, 'You are not authorized to disconnect this connection.');
  }

  if (connection.status !== 'accepted') {
    throw new HttpError(400, `Cannot disconnect a connection that is ${connection.status}.`);
  }

  // Update status in MongoDB
  connection.status = 'cancelled';
  connection.respondedAt = new Date();
  await connection.save();

  // Crucially, after database status update succeeds, revoke active socket rooms and typing state
  await revokeConnectionConversations(connection._id);

  // Notify the other participant
  const otherUserId = isSender ? connection.recipient : connection.sender;
  await Notification.create({
    recipient: otherUserId,
    actor: currentUserId,
    type: 'connection_rejected',
    connectionId: connection._id,
  }).catch(() => {});

  return response.json({
    connection: formatConnectionBasic(connection, currentUserId),
    message: 'Connection disconnected and conversations revoked.',
  });
};

export const getConnections: RequestHandler = async (request, response) => {
  const currentUserId = request.user!._id;
  const page = Math.max(1, parseInt(String(request.query.page || '1'), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(request.query.limit || '10'), 10) || 10));

  const query: mongoose.FilterQuery<any> = {
    status: 'accepted',
    $or: [{ sender: currentUserId }, { recipient: currentUserId }],
  };

  const total = await Connection.countDocuments(query);
  const totalPages = Math.ceil(total / limit) || 1;
  const skip = (page - 1) * limit;

  const connections = await Connection.find(query)
    .sort({ respondedAt: -1, updatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate<{ sender: UserDocument }>('sender', 'name profile')
    .populate<{ recipient: UserDocument }>('recipient', 'name profile');

  const currentUserPreferences = await RoommatePreferences.findOne({ userId: currentUserId });

  const items = await Promise.all(
    connections.map(async (conn) => {
      const isSender = conn.sender._id.equals(currentUserId);
      const otherUser = isSender ? conn.recipient : conn.sender;
      let compatibility = null;

      if (currentUserPreferences && currentUserPreferences.isCompleted && otherUser) {
        const otherPref = await RoommatePreferences.findOne({ userId: otherUser._id });
        if (otherPref && otherPref.isCompleted) {
          compatibility = calculateCompatibility(currentUserPreferences, otherPref);
        }
      }

      return {
        id: conn._id.toString(),
        user: otherUser ? toSafeProfile(otherUser) : null,
        status: conn.status,
        connectedAt: (conn.respondedAt || conn.updatedAt).toISOString(),
        createdAt: conn.createdAt.toISOString(),
        compatibility: compatibility
          ? {
              overallScore: compatibility.overallScore,
              summary: compatibility.summary,
              strengths: compatibility.strengths,
            }
          : null,
      };
    }),
  );

  response.json({
    connections: items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  });
};

export const getConnectionById: RequestHandler = async (request, response) => {
  const currentUserId = request.user!._id;
  const idParam = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;

  if (!isValidObjectId(idParam)) {
    throw new HttpError(400, 'Invalid connection ID.');
  }

  const connection = await Connection.findById(idParam)
    .populate<{ sender: UserDocument }>('sender', 'name profile')
    .populate<{ recipient: UserDocument }>('recipient', 'name profile');

  if (!connection) {
    throw new HttpError(404, 'Connection not found.');
  }

  const isSender = connection.sender._id.equals(currentUserId);
  const isRecipient = connection.recipient._id.equals(currentUserId);

  if (!isSender && !isRecipient) {
    throw new HttpError(403, 'You are not authorized to view this connection.');
  }

  const otherUser = isSender ? connection.recipient : connection.sender;

  // Retrieve preferences for compatibility & shared lifestyle summary
  const currentUserPreferences = await RoommatePreferences.findOne({ userId: currentUserId });
  const otherUserPreferences = await RoommatePreferences.findOne({ userId: otherUser._id });

  let compatibility = null;
  const sharedLifestyle: { category: string; description: string }[] = [];

  if (
    currentUserPreferences &&
    currentUserPreferences.isCompleted &&
    otherUserPreferences &&
    otherUserPreferences.isCompleted
  ) {
    compatibility = calculateCompatibility(currentUserPreferences, otherUserPreferences);

    // Build curated safe lifestyle comparisons without revealing full raw questionnaire documents
    if (currentUserPreferences.sleepSchedule && otherUserPreferences.sleepSchedule) {
      sharedLifestyle.push({
        category: 'Sleep & Routines',
        description: `${formatEnumLabel(currentUserPreferences.sleepSchedule.dailyRoutine)} (${currentUserPreferences.sleepSchedule.bedtime}–${currentUserPreferences.sleepSchedule.wakeUpTime}) & ${formatEnumLabel(otherUserPreferences.sleepSchedule.dailyRoutine)} (${otherUserPreferences.sleepSchedule.bedtime}–${otherUserPreferences.sleepSchedule.wakeUpTime})`,
      });
    }

    if (currentUserPreferences.cleanliness && otherUserPreferences.cleanliness) {
      sharedLifestyle.push({
        category: 'Cleanliness Standards',
        description: `${formatEnumLabel(currentUserPreferences.cleanliness.cleanlinessLevel)} (${formatEnumLabel(currentUserPreferences.cleanliness.cleaningFrequency)}) & ${formatEnumLabel(otherUserPreferences.cleanliness.cleanlinessLevel)} (${formatEnumLabel(otherUserPreferences.cleanliness.cleaningFrequency)})`,
      });
    }

    if (currentUserPreferences.noise && otherUserPreferences.noise) {
      sharedLifestyle.push({
        category: 'Noise & Quiet Hours',
        description: `Quiet hours: ${currentUserPreferences.noise.quietHoursStart}–${currentUserPreferences.noise.quietHoursEnd} and ${otherUserPreferences.noise.quietHoursStart}–${otherUserPreferences.noise.quietHoursEnd}`,
      });
    }

    if (currentUserPreferences.budget && otherUserPreferences.budget) {
      sharedLifestyle.push({
        category: 'Housing & Budget Range',
        description: `₹${currentUserPreferences.budget.minRent.toLocaleString()}–₹${currentUserPreferences.budget.maxRent.toLocaleString()} (${formatEnumLabel(currentUserPreferences.budget.accommodationType)}) and ₹${otherUserPreferences.budget.minRent.toLocaleString()}–₹${otherUserPreferences.budget.maxRent.toLocaleString()} (${formatEnumLabel(otherUserPreferences.budget.accommodationType)})`,
      });
    }
  }

  response.json({
    connection: {
      id: connection._id.toString(),
      status: connection.status,
      message: connection.message,
      createdAt: connection.createdAt.toISOString(),
      respondedAt: connection.respondedAt ? connection.respondedAt.toISOString() : null,
      isSender,
      user: toSafeProfile(otherUser),
      compatibility,
      sharedLifestyle,
    },
  });
};

export const getConnectionSummary: RequestHandler = async (request, response) => {
  const currentUserId = request.user!._id;

  const [incomingPendingCount, outgoingPendingCount, acceptedCount, recentConnections] = await Promise.all([
    Connection.countDocuments({ recipient: currentUserId, status: 'pending' }),
    Connection.countDocuments({ sender: currentUserId, status: 'pending' }),
    Connection.countDocuments({ status: 'accepted', $or: [{ sender: currentUserId }, { recipient: currentUserId }] }),
    Connection.find({ $or: [{ sender: currentUserId }, { recipient: currentUserId }] })
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate<{ sender: UserDocument }>('sender', 'name profile')
      .populate<{ recipient: UserDocument }>('recipient', 'name profile'),
  ]);

  const recentActivity = recentConnections.map((conn) => {
    const isSender = conn.sender._id.equals(currentUserId);
    const otherUser = isSender ? conn.recipient : conn.sender;
    return {
      id: conn._id.toString(),
      status: conn.status,
      direction: isSender ? ('sent' as const) : ('received' as const),
      otherUser: otherUser ? toSafeProfile(otherUser) : null,
      timestamp: conn.updatedAt.toISOString(),
      message: conn.message,
    };
  });

  response.json({
    incomingPendingCount,
    outgoingPendingCount,
    acceptedCount,
    recentActivity,
  });
};
