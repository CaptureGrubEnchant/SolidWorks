/**
 * Logger utility for SolidWorks MCP Server
 */

import winston from 'winston';

const { combine, timestamp, printf, errors } = winston.format;

// Custom format for console output
const _consoleFormat = printf(({ level, message, timestamp: ts, stack, ...metadata }) => {
  let msg = `${ts} [${level}]: ${message}`;

  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }

  if (stack) {
    msg += `\n${stack}`;
  }

  return msg;
});

// Create logger instance
// For MCP servers, we must NOT log to stdout/console as it interferes with JSON-RPC
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true })),
  transports: [
    // File transport only - NO console output for MCP compatibility
    new winston.transports.File({
      filename: process.env.MCP_LOG_FILE || 'solidworks-mcp.log',
      format: combine(timestamp(), winston.format.json()),
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
});

// Add error-only file in production
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'solidworks-mcp-error.log',
      level: 'error',
      format: combine(timestamp(), winston.format.json()),
    })
  );
}

// Logger helper functions
export function logInfo(message: string, metadata?: any): void {
  logger.info(message, metadata);
}

export function logError(message: string, error?: Error | any): void {
  if (error instanceof Error) {
    logger.error(message, { error: error.message, stack: error.stack });
  } else {
    logger.error(message, { error });
  }
}

export function logWarning(message: string, metadata?: any): void {
  logger.warn(message, metadata);
}

export function logDebug(message: string, metadata?: any): void {
  logger.debug(message, metadata);
}

// Log operation execution
export function logOperation(operation: string, status: 'started' | 'completed' | 'failed', metadata?: any): void {
  const message = `Operation ${operation} ${status}`;

  switch (status) {
    case 'started':
      logDebug(message, metadata);
      break;
    case 'completed':
      logInfo(message, metadata);
      break;
    case 'failed':
      logError(message, metadata);
      break;
  }
}

// Log resource operations
export function logResource(resourceType: string, action: string, resourceId: string, metadata?: any): void {
  logger.info(`Resource ${resourceType} ${action}`, { resourceId, ...metadata });
}

// Log API calls
export function logAPICall(method: string, endpoint: string, status: number, duration?: number): void {
  const level = status >= 400 ? 'error' : 'info';
  logger.log(level, `API ${method} ${endpoint}`, { status, duration });
}

// Export logger instance for direct use
export default logger;
