/**
 * Authentication module exports.
 *
 * Auth managers are instantiated with their required dependencies (persistence provider).
 * They no longer use the singleton pattern or ContextNode initialization.
 * @lastreviewed null
 */
export { AuthManager } from './AuthManager';
export { AuthObject } from './AuthObject';
export { BasicAuthManager } from './BasicAuthManager';
export { BasicAuth } from './BasicAuth';
