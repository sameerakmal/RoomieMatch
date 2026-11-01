import { Router } from 'express';
import {
  acceptRequest,
  cancelRequest,
  disconnectConnection,
  getConnectionById,
  getConnections,
  getConnectionSummary,
  getReceivedRequests,
  getSentRequests,
  rejectRequest,
  sendRequest,
} from '../controllers/connectionController.js';
import { authenticate } from '../middleware/authenticate.js';
import { protectMutation } from '../middleware/requestSecurity.js';

export const connectionRoutes = Router();

connectionRoutes.use(protectMutation, authenticate);

// Read-only queries with specific paths (must come before /:id)
connectionRoutes.get('/received', getReceivedRequests);
connectionRoutes.get('/sent', getSentRequests);
connectionRoutes.get('/summary', getConnectionSummary);
connectionRoutes.get('/', getConnections);
connectionRoutes.get('/:id', getConnectionById);

// Connection action mutations
connectionRoutes.post('/request/:userId', sendRequest);
connectionRoutes.patch('/:id/accept', acceptRequest);
connectionRoutes.patch('/:id/reject', rejectRequest);
connectionRoutes.patch('/:id/cancel', cancelRequest);
connectionRoutes.patch('/:id/disconnect', disconnectConnection);
connectionRoutes.delete('/:id', disconnectConnection);

