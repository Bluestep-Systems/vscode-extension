import type { BearerAuthParams } from '../types';
import type { ILogger, IPersistence, IPrompt } from '../providers';

const PERSISTENCE_KEY = 'bearerToken';
const DEFAULT_LABEL = 'default';

/**
 * Keys previously used to store basic-auth credentials. Purged on first use
 * so an upgrade from basic auth leaves no orphan secrets behind.
 */
const LEGACY_BASIC_AUTH_KEYS = ['basicAuth', 'b6p:basic_auth'] as const;

/**
 * Core-layer bearer-token auth provider.
 *
 * Stores a single API token plus a human-readable label and produces a
 * `Bearer <token>` Authorization header. Replaces the username/password flow.
 */
export class BearerAuthProvider {
  private legacyPurged = false;

  constructor(
    private readonly persistence: IPersistence,
    private readonly prompt: IPrompt,
    private readonly logger: ILogger,
  ) {}

  /**
   * Returns the Bearer auth header value (`"Bearer <token>"`).
   * Prompts for a token if none is stored.
   */
  async authHeaderValue(): Promise<string> {
    const creds = await this.getOrCreate();
    return `Bearer ${creds.token}`;
  }

  /**
   * Get stored token, or prompt and store one if absent.
   */
  async getOrCreate(): Promise<BearerAuthParams> {
    await this.purgeLegacy();
    const raw = await this.persistence.getSecret(PERSISTENCE_KEY);
    if (raw) {
      return JSON.parse(raw) as BearerAuthParams;
    }
    this.prompt.info('No existing token found, please enter a new token.');
    return this.createNew();
  }

  /**
   * Prompt for a new token and label, then store them.
   */
  async createNew(): Promise<BearerAuthParams> {
    const token = await this.prompt.inputBox({ prompt: 'Enter your API token', password: true });
    if (token === undefined) {
      throw new Error('Token entry cancelled');
    }
    const labelInput = await this.prompt.inputBox({
      prompt: 'Label for this token (identifies the credential profile)',
      value: DEFAULT_LABEL,
    });
    if (labelInput === undefined) {
      throw new Error('Token entry cancelled');
    }
    const creds: BearerAuthParams = { token, label: labelInput || DEFAULT_LABEL };
    await this.persistence.setSecret(PERSISTENCE_KEY, JSON.stringify(creds));
    this.logger.info('Token stored');
    return creds;
  }

  /**
   * Update the stored token (prompts; empty input keeps current value).
   */
  async update(): Promise<BearerAuthParams> {
    const existing = await this.getOrCreate();
    const newToken = await this.prompt.inputBox({
      prompt: 'Enter new token (empty to keep current)',
      password: true,
    });
    if (newToken === undefined) {
      this.prompt.info('Cancelled');
      return existing;
    }
    const newLabel = await this.prompt.inputBox({
      prompt: 'Label (empty to keep current)',
      value: existing.label,
    });
    if (newLabel === undefined) {
      this.prompt.info('Cancelled');
      return existing;
    }
    const creds: BearerAuthParams = {
      token: newToken || existing.token,
      label: newLabel || existing.label,
    };
    await this.persistence.setSecret(PERSISTENCE_KEY, JSON.stringify(creds));
    if (creds.token === existing.token && creds.label === existing.label) {
      this.prompt.info('No changes made to token.');
    } else {
      this.prompt.info('Token updated!');
    }
    return creds;
  }

  /**
   * Clear the stored token. Also drops any legacy basic-auth secret.
   */
  async clear(): Promise<void> {
    await this.persistence.deleteSecret(PERSISTENCE_KEY);
    await this.purgeLegacy(true);
  }

  /**
   * Whether a token is currently stored.
   */
  async hasCredentials(): Promise<boolean> {
    const raw = await this.persistence.getSecret(PERSISTENCE_KEY);
    return raw !== undefined;
  }

  /**
   * Delete any leftover basic-auth secrets from before the bearer-token
   * switchover. Memoized so it only runs once per provider instance.
   */
  private async purgeLegacy(force = false): Promise<void> {
    if (this.legacyPurged && !force) {return;}
    this.legacyPurged = true;
    for (const key of LEGACY_BASIC_AUTH_KEYS) {
      try {
        await this.persistence.deleteSecret(key);
      } catch (e) {
        this.logger.debug(
          `Failed to purge legacy auth key ${key}:`,
          e instanceof Error ? e.message : String(e),
        );
      }
    }
  }
}
