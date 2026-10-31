import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError } from '../utils/HttpError.js';

export const notFound: RequestHandler = (_request, _response, next) => next(new HttpError(404, 'Route not found.'));
export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, next) => {
  if (response.headersSent) { next(error); return; }
  let status = 500;
  let message = 'An unexpected error occurred.';
  if (error instanceof HttpError) { status = error.status; message = error.message; }
  else if (error && typeof error === 'object' && 'type' in error) {
    if (error.type === 'entity.parse.failed') { status = 400; message = 'Request body must be valid JSON.'; }
    if (error.type === 'entity.too.large') { status = 413; message = 'Request body is too large.'; }
  }
  if (status === 500) console.error('Unhandled request error.');
  response.status(status).json({ error: { message, status } });
};
