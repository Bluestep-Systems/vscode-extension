import type { ILogger } from '../../core/providers';

export class CliLogger implements ILogger {
  private readonly verbose: boolean;

  constructor(opts: { verbose?: boolean } = {}) {
    this.verbose = opts.verbose ?? false;
  }

  info(...args: unknown[]): void {
    if (this.verbose) {
      process.stderr.write(`[INFO] ${args.map(String).join(' ')}\n`);
    }
  }

  warn(...args: unknown[]): void {
    process.stderr.write(`[WARN] ${args.map(String).join(' ')}\n`);
  }

  error(...args: unknown[]): void {
    process.stderr.write(`[ERROR] ${args.map(String).join(' ')}\n`);
  }

  debug(...args: unknown[]): void {
    if (this.verbose) {
      process.stderr.write(`[DEBUG] ${args.map(String).join(' ')}\n`);
    }
  }
}
