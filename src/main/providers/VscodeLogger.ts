import * as vscode from 'vscode';
import type { ILogger } from '../../core/providers';

/**
 * VSCode implementation of the logger provider.
 * Wraps a vscode.OutputChannel.
 */
export class VscodeLogger implements ILogger {
  constructor(private readonly channel: vscode.OutputChannel) {}

  info(...args: unknown[]): void {
    this.channel.appendLine(args.map(this.stringify).join(' '));
  }

  warn(...args: unknown[]): void {
    this.channel.appendLine('WARNING: ' + args.map(this.stringify).join(' '));
  }

  error(...args: unknown[]): void {
    this.channel.appendLine('ERROR: ' + args.map(this.stringify).join(' '));
  }

  debug(...args: unknown[]): void {
    this.channel.appendLine('DEBUG: ' + args.map(this.stringify).join(' '));
  }

  private stringify(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    if (value instanceof Error) {
      return value.stack || value.message;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
}
