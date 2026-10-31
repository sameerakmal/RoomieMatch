import mongoose from 'mongoose';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';

async function start(): Promise<void> {
  await connectDatabase();
  const server = app.listen(env.port, error => {
    if (!error) console.info(`RoomieMatch API: http://localhost:${env.port}`);
  });
  server.on('error', async () => {
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
    server.close(() => {
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
