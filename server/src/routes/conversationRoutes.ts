import { Router } from 'express';
import {
  getConversationById,
  getConversations,
  getMessages,
  getOrCreateConversation,
  getUnreadCount,
  markConversationAsRead,
} from '../controllers/conversationController.js';
import { authenticate } from '../middleware/authenticate.js';
import { protectMutation } from '../middleware/requestSecurity.js';

export const conversationRoutes = Router();

conversationRoutes.use(protectMutation, authenticate);

// Read-only queries with specific paths (must come before /:id)
conversationRoutes.get('/', getConversations);
conversationRoutes.get('/unread-count', getUnreadCount);

// Conversation details and history
conversationRoutes.get('/:id', getConversationById);
conversationRoutes.get('/:id/messages', getMessages);

// Actions and mutations
conversationRoutes.post('/:connectionId', getOrCreateConversation);
conversationRoutes.patch('/:id/read', markConversationAsRead);

