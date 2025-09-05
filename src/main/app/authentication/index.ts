import { ContextNode } from '../context/ContextNode';
import { AuthManager, AuthObject } from './classes';
import { BASIC_AUTH_MANAGER } from './managers/BasicAuthManager';

export { AuthError, AuthManager, AuthObject } from './classes';
/**
 * Namespace for authentication related utilities and functions.
 */
export namespace Auth {

  /**
   * A map of all available auth managers, keyed by their type.
   */
  const MANAGERS = new Map<string, AuthManager<AuthObject>>([
    ['basic', BASIC_AUTH_MANAGER],
  ]);

  /**
   * Determines the appropriate auth manager needed.
   * 
   * NOTE: only Basic Auth is currently supported, so this will always return the
   * basic auth manager. This will need to be updated when other auth types are
   * supported.
   * @returns the appropriate auth manager
   */
  export function determineManager(): AuthManager<AuthObject> {
    return MANAGERS.get('basic')!;
  }

  /**
   * initializes all auth managers with the given context node as its parent.
   * @param node 
   */
  export function initManagers(node: ContextNode) {
    MANAGERS.forEach(manager => manager.init(node));
  }

  export function clearManagers() {
    MANAGERS.forEach(manager => manager.clearPersistance());
  }
}
