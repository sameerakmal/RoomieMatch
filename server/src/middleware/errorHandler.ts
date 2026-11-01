import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError } from '../utils/HttpError.js';
import mongoose from 'mongoose';

export const notFound: RequestHandler = (_request, _response, next) => next(new HttpError(404, 'Route not found.'));
export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, next) => {
  if (response.headersSent) { next(error); return; }
  let status = 500;
  let message = 'An unexpected error occurred.';
  let fields: Record<string, string> | undefined;
  if (error instanceof HttpError) { status = error.status; message = error.message; fields = error.fields; }
  else if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
    status = 409; message = 'An account with this email already exists.'; fields = { email: 'This email is already registered. Try logging in.' };
  }
  else if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError || error instanceof mongoose.Error.StrictModeError) {
    status = 400; message = 'Please check your profile fields and try again.';
  }
  else if (error instanceof mongoose.mongo.MongoNetworkError || error instanceof mongoose.mongo.MongoServerSelectionError) {
    status = 503; message = 'Account services are temporarily unavailable. Please try again shortly.';
  }
  else if (error && typeof error === 'object' && 'type' in error) {
    if (error.type === 'entity.parse.failed') { status = 400; message = 'Request body must be valid JSON.'; }
    if (error.type === 'entity.too.large') { status = 413; message = 'Request body is too large.'; }
  }
  if (status === 500) console.error('Unhandled request error.');
  response.status(status).json({ error: { message, status, ...(fields ? { fields } : {}) } });
};
