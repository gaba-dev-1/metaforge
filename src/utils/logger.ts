export enum LogSeverity {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

/**
 * Simple structured logger for improved output
 */
export function logMessage(
  severity: LogSeverity,
  message: string,
  details?: any
) {
  const timestamp = new Date().toISOString();
  
  // Color coding for console
  const colors = {
    DEBUG: '\x1b[36m', // Cyan
    INFO: '\x1b[32m',  // Green
    WARN: '\x1b[33m',  // Yellow
    ERROR: '\x1b[31m', // Red
    RESET: '\x1b[0m'   // Reset
  };
  
  // Format message for console
  const logPrefix = `${colors[severity]}[${timestamp}] [${severity}]${colors.RESET}`;
  
  console.log(`${logPrefix} ${message}`);
  
  // Log details if present
  if (details) {
    if (details instanceof Error) {
      console.log(`${logPrefix} Error details:`, {
        name: details.name,
        message: details.message,
        stack: details.stack
      });
    } else {
      console.log(`${logPrefix} Details:`, details);
    }
  }
}
