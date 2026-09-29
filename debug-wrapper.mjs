#!/usr/bin/env node

// Debug wrapper for SolidWorks MCP Server
console.error('[DEBUG] SolidWorks MCP Server starting...');

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled rejection at:', promise);
  console.error('Reason:', reason);
  process.exit(1);
});

try {
  console.error('[DEBUG] Loading server module...');
  await import('./dist/index.js');
  console.error('[DEBUG] Server module loaded');
} catch (error) {
  console.error('[FATAL] Failed to load server:', error.message);
  console.error(error.stack);
  process.exit(1);
}