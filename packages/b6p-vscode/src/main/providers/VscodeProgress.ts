import * as vscode from 'vscode';
import type { IProgress, ProgressTask } from '@bluestep-systems/b6p-core';

interface ProgressOptions {
  title: string;
  location?: vscode.ProgressLocation;
  cancellable?: boolean;
  showItemCount?: boolean;
  cleanupMessage?: string;
}

/**
 * VSCode implementation of the progress provider.
 * Provides progress indication for tasks using VS Code's native progress API.
 */
export class VscodeProgress implements IProgress {
  async withProgress<T>(
    tasks: ProgressTask<T>[],
    options: { title: string; showItemCount?: boolean; cleanupMessage?: string }
  ): Promise<T[]> {
    return this.withProgressInternal(tasks, {
      title: options.title,
      location: vscode.ProgressLocation.Notification,
      cancellable: false,
      showItemCount: options.showItemCount ?? true,
      cleanupMessage: options.cleanupMessage,
    });
  }

  /**
   * Executes a list of tasks sequentially with progress indication.
   * @param tasks Array of tasks to execute
   * @param options Progress configuration options
   * @returns Promise that resolves when all tasks are complete
   */
  private async withProgressInternal<T>(
    tasks: ProgressTask<T>[],
    options: ProgressOptions
  ): Promise<T[]> {
    const {
      title,
      location = vscode.ProgressLocation.Notification,
      cancellable = false,
      showItemCount = true,
      cleanupMessage
    } = options;

    return vscode.window.withProgress(
      {
        location,
        title,
        cancellable
      },
      async (progress) => {
        const TOTAL_TASKS = tasks.length;
        let COMPLETED_TASKS = 0;
        const INCREMENT_PER_TASK = TOTAL_TASKS > 0 ? 100 / TOTAL_TASKS : 100;
        const results: T[] = [];

        const updateProgress = (description?: string) => {
          COMPLETED_TASKS++;
          const message = showItemCount
            ? `Completed ${COMPLETED_TASKS} of ${TOTAL_TASKS}${description ? ` - ${description}` : ''}`
            : description || '';

          progress.report({
            increment: INCREMENT_PER_TASK,
            message
          });
        };

        // Execute tasks sequentially
        for (const task of tasks) {
          const result = await task.execute();
          results.push(result);
          updateProgress(task.description);
        }

        // Show cleanup message if provided
        if (cleanupMessage) {
          progress.report({ message: cleanupMessage });
        }

        // Ensure we reach 100% progress
        progress.report({ increment: 100, message: "Complete!" });

        return results;
      }
    );
  }

  /**
   * Executes a single async operation with progress indication.
   * Useful for operations that don't have discrete tasks but want to show progress.
   */
  async withSimpleProgress<T>(
    operation: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<T>,
    options: { title: string; location?: vscode.ProgressLocation; cancellable?: boolean }
  ): Promise<T> {
    const {
      title,
      location = vscode.ProgressLocation.Notification,
      cancellable = false
    } = options;

    return vscode.window.withProgress(
      {
        location,
        title,
        cancellable
      },
      operation
    );
  }
}
