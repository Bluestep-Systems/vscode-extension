import * as vscode from 'vscode';
import type { IProgress, ProgressTask } from '../../core/providers';

/**
 * VSCode implementation of the progress provider.
 * Wraps vscode.window.withProgress API.
 */
export class VscodeProgress implements IProgress {
  async withProgress<T>(
    tasks: ProgressTask<T>[],
    options: { title: string; showItemCount?: boolean; cleanupMessage?: string }
  ): Promise<T[]> {
    return await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: options.title,
        cancellable: false,
      },
      async (progress) => {
        const results: T[] = [];
        const total = tasks.length;

        for (let i = 0; i < total; i++) {
          const task = tasks[i];
          const increment = 100 / total;

          if (options.showItemCount) {
            progress.report({
              increment,
              message: `${i + 1}/${total}${task.description ? `: ${task.description}` : ''}`,
            });
          } else {
            progress.report({
              increment,
              message: task.description,
            });
          }

          const result = await task.execute();
          results.push(result);
        }

        if (options.cleanupMessage) {
          progress.report({ message: options.cleanupMessage });
        }

        return results;
      }
    );
  }
}
