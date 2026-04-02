import * as readline from 'readline/promises';
import type { IPrompt } from '../../core/providers';

/**
 * CLI implementation of the prompt provider.
 *
 * When `autoYes` is true, confirmations return the first option automatically
 * and input boxes return their default value (or throw if none). This enables
 * non-interactive usage with `--yes`.
 */
export class CliPrompt implements IPrompt {
  private rl: readline.Interface | null = null;
  private readonly autoYes: boolean;
  private readonly jsonMode: boolean;

  constructor(opts: { autoYes?: boolean; json?: boolean } = {}) {
    this.autoYes = opts.autoYes ?? false;
    this.jsonMode = opts.json ?? false;
  }

  private getRL(): readline.Interface {
    if (!this.rl) {
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stderr, // keep stdout clean for --json
      });
    }
    return this.rl;
  }

  async inputBox(options: { prompt: string; password?: boolean; value?: string }): Promise<string | undefined> {
    if (this.autoYes && options.value !== undefined) {
      return options.value;
    }
    const answer = await this.getRL().question(`${options.prompt}: `);
    return answer || undefined;
  }

  async confirm(message: string, options: string[]): Promise<string | undefined> {
    if (this.autoYes) {
      return options[0];
    }
    const optStr = options.map((o, i) => i === 0 ? `[${o}]` : o).join(' / ');
    const answer = await this.getRL().question(`${message}\n${optStr}: `);
    if (!answer) {
      return options[0]; // default to first option on empty input
    }
    const match = options.find(o => o.toLowerCase() === answer.toLowerCase());
    return match;
  }

  info(message: string): void {
    if (!this.jsonMode) {
      process.stderr.write(`${message}\n`);
    }
  }

  async popup(message: string): Promise<void> {
    this.info(message);
  }

  warn(message: string): void {
    process.stderr.write(`WARNING: ${message}\n`);
  }

  error(message: string): void {
    process.stderr.write(`ERROR: ${message}\n`);
  }

  /** Close the readline interface. Call when the CLI is done. */
  close(): void {
    this.rl?.close();
    this.rl = null;
  }
}
