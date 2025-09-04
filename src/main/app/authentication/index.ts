import { ContextNode } from '../services/ContextNode';
import { AuthManager, AuthObject } from './classes';
import { BASIC_AUTH_MANAGER } from './managers/BasicAuthManager';

export namespace Auth {

  export function determineManager(): AuthManager<AuthObject> {
    return BASIC_AUTH_MANAGER;
  }

  export function initManagers(node: ContextNode) {
    BASIC_AUTH_MANAGER.init(node);
  }
}
