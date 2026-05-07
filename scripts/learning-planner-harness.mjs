#!/usr/bin/env node
import process from 'node:process';
import { createLogger, createServer } from 'vite';

const logger = createLogger('error');
const logError = logger.error.bind(logger);
logger.error = (message, options) => {
  if (String(message || '').includes('WebSocket server error')) {
    return;
  }
  logError(message, options);
};

const server = await createServer({
  appType: 'custom',
  cacheDir: 'node_modules/.vite-learning-planner-harness',
  configFile: false,
  customLogger: logger,
  logLevel: 'error',
  server: {
    middlewareMode: true,
    hmr: { port: 0 },
  },
});

try {
  const { runLearningHarnessCommand } = await server.ssrLoadModule('/src/dev/learningPlannerHarness.js');
  const result = await runLearningHarnessCommand(process.argv.slice(2), { env: process.env });
  process.stdout.write(`${result.outputText}\n`);
} catch (error) {
  process.stderr.write(`${error?.message || String(error)}\n`);
  process.exitCode = 1;
} finally {
  await server.close();
}
