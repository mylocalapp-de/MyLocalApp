/**
 * Debug Logger - Only logs in development mode
 * 
 * Usage:
 *   import { logger } from '../utils/logger';
 *   logger.log('[Component]', 'message', data);
 *   logger.warn('[Component]', 'warning');
 *   logger.error('[Component]', 'error', error);
 */

const isDev = __DEV__;

export const logger = {
  log: (...args) => {
    if (isDev) {
      // console.log(...args);
    }
  },
  
  warn: (...args) => {
    if (isDev) {
      console.warn(...args);
    }
  },
  
  error: (...args) => {
    // Errors should always log (for crash reporting)
    console.error(...args);
  },
  
  // For specific subsystems (can be toggled individually)
  auth: (...args) => {
    if (isDev) {
      // console.log('[Auth]', ...args);
    }
  },
  
  network: (...args) => {
    if (isDev) {
      // console.log('[Network]', ...args);
    }
  },
  
  org: (...args) => {
    if (isDev) {
      // console.log('[Org]', ...args);
    }
  },
};

export default logger;
