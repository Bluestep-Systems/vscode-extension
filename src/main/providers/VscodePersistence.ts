import * as vscode from 'vscode';
import type { IPersistence } from '../../core/providers';

/**
 * VSCode implementation of the persistence provider.
 *
 * Provides direct access to VSCode's workspace state and secret storage.
 * Keys are used as-is without modification - callers are responsible for
 * using appropriate prefixes (e.g., PublicKeys/PrivateKeys enums already
 * include 'b6p:' prefixes).
 *
 * This unified persistence layer is shared between B6PCore and the legacy
 * extension code (PublicPersistanceMap/PrivatePersistanceMap).
 */
export class VscodePersistence implements IPersistence {
  constructor(private readonly context: vscode.ExtensionContext) {}

  async get<T>(key: string): Promise<T | undefined> {
    return this.context.workspaceState.get<T>(key);
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.context.workspaceState.update(key, value);
  }

  async delete(key: string): Promise<void> {
    await this.context.workspaceState.update(key, undefined);
  }

  async getSecret(key: string): Promise<string | undefined> {
    return await this.context.secrets.get(key);
  }

  async setSecret(key: string, value: string): Promise<void> {
    await this.context.secrets.store(key, value);
  }

  async deleteSecret(key: string): Promise<void> {
    await this.context.secrets.delete(key);
  }

  async clearPublic(): Promise<void> {
    // Clear all workspace state keys
    const keys = this.context.workspaceState.keys();
    for (const key of keys) {
      await this.context.workspaceState.update(key, undefined);
    }
  }

  async clearSecrets(): Promise<void> {
    // Note: VSCode doesn't provide a way to enumerate secret keys,
    // so we can't implement this without tracking keys separately.
  }
}
