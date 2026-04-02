import type { IProgress, ProgressTask } from '../../core/providers';

export class CliProgress implements IProgress {
  private readonly quiet: boolean;

  constructor(opts: { quiet?: boolean } = {}) {
    this.quiet = opts.quiet ?? false;
  }

  async withProgress<T>(
    tasks: ProgressTask<T>[],
    options: { title: string; showItemCount?: boolean; cleanupMessage?: string }
  ): Promise<T[]> {
    const total = tasks.length;
    let completed = 0;
    const results: T[] = [];

    if (!this.quiet) {
      process.stderr.write(`${options.title}\n`);
    }

    for (const task of tasks) {
      const result = await task.execute();
      results.push(result);
      completed++;

      if (!this.quiet) {
        const pct = Math.round((completed / total) * 100);
        const desc = task.description ? ` - ${task.description}` : '';
        process.stderr.write(`\r  [${completed}/${total}] ${pct}%${desc}`);
      }
    }

    if (!this.quiet) {
      process.stderr.write('\n');
      if (options.cleanupMessage) {
        process.stderr.write(`  ${options.cleanupMessage}\n`);
      }
    }

    return results;
  }
}
