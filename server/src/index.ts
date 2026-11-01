import http from 'node:http';
import mongoose from 'mongoose';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { initSocketServer } from './realtime/socketServer.js';

async function start(): Promise<void> {
  await connectDatabase();
  const httpServer = http.createServer(app);
  initSocketServer(httpServer);

  httpServer.listen(env.port, () => {
    console.info(`RoomieMatch API & Socket.IO: http://localhost:${env.port}`);
  });
  httpServer.on('error', async () => {
    console.error('Unable to start HTTP server. Check PORT availability.');
    await mongoose.disconnect();
    process.exit(1);
  });
  let stopping = false;
  function shutdown() {
    if (stopping) return;
    stopping = true;
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    httpServer.close(() => {
      void mongoose.disconnect().then(() => { clearTimeout(timeout); process.exit(0); }).catch(() => process.exit(1));
    });
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
start().catch(() => {
  // Connection errors can contain credentials; do not print raw errors or URIs.
  console.error('Startup failed. Check MongoDB availability and environment configuration.');
  process.exit(1);
});
