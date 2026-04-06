import * as vscode from 'vscode';
import type { IProgress, ProgressTask } from '../../core/providers';
import { ProgressHelper } from '../app/util/ui/ProgressHelper';

/**
 * VSCode implementation of the progress provider.
 * Delegates to ProgressHelper for consistent progress indication across the extension.
 */
export class VscodeProgress implements IProgress {
  async withProgress<T>(
    tasks: ProgressTask<T>[],
    options: { title: string; showItemCount?: boolean; cleanupMessage?: string }
  ): Promise<T[]> {
    return ProgressHelper.withProgress(tasks, {
      title: options.title,
      location: vscode.ProgressLocation.Notification,
      cancellable: false,
      showItemCount: options.showItemCount ?? true,
      cleanupMessage: options.cleanupMessage,
    });
  }
}
