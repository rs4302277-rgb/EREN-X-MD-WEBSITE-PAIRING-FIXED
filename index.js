'use strict';

const { autoLoadPairs } = require('./autoload');
const { startWebServer } = require('./web');

let shuttingDown = false;
let server = null;

async function main() {
  console.log('🤖 Eren MD WhatsApp runtime starting...');
  server = startWebServer();
  const result = await autoLoadPairs({ batchSize: 3, concurrent: false });
  console.log(`✅ Session autoload complete: ${result.successful || 0}/${result.total || 0} session(s) loaded.`);
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`🛑 ${signal}: shutting down.`);
  if (server) await new Promise(resolve => server.close(resolve));
  setTimeout(() => process.exit(0), 100).unref();
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', error => console.error('[uncaughtException]', error));
process.on('unhandledRejection', error => console.error('[unhandledRejection]', error));

main().catch(error => {
  console.error('❌ Startup failed:', error);
  process.exitCode = 1;
});

module.exports = { main };
