import { config } from './config';
import { createApp, ensureBackendInitialized } from './app';

async function main() {
  await ensureBackendInitialized();
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`[dbms-lab] Server listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error('[dbms-lab] Fatal startup error:', err);
  process.exit(1);
});
