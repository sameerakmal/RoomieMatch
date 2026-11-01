import http from 'node:http';
import mongoose from 'mongoose';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { initSocketServer, closeSocketServer } from './realtime/socketServer.js';

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection detected.');
  if (reason instanceof Error) {
    console.error(reason.message);
  }
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception detected:', error.message);
  process.exit(1);
});

async function start(): Promise<void> {
  await connectDatabase();
  const httpServer = http.createServer(app);
  initSocketServer(httpServer);

  httpServer.listen(env.port, '0.0.0.0', () => {
    console.info(`RoomieMatch API & Socket.IO listening on 0.0.0.0:${env.port} [${env.nodeEnv}]`);
  });

  httpServer.on('error', async () => {
    console.error('Unable to start HTTP server. Check PORT availability.');
    await mongoose.disconnect();
    process.exit(1);
  });

  let stopping = false;
  function shutdown(signal: string) {
    if (stopping) return;
    stopping = true;
    console.info(`Received ${signal}. Gracefully shutting down...`);

    const timeout = setTimeout(() => {
      console.error('Graceful shutdown timed out after 10s. Forcing exit.');
      process.exit(1);
    }, 10000);
    timeout.unref();

    try {
      closeSocketServer();
    } catch {
      console.error('Error closing Socket.IO connections.');
    }

    httpServer.close(() => {
      void mongoose.disconnect()
        .then(() => {
          clearTimeout(timeout);
          console.info('MongoDB disconnected cleanly.');
          process.exit(0);
        })
        .catch(() => process.exit(1));
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch(() => {
  // Connection errors can contain credentials; do not print raw errors or URIs.
  console.error('Startup failed. Check MongoDB availability and environment configuration.');
  process.exit(1);
});
