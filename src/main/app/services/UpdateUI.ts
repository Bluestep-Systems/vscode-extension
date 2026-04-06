import * as vscode from 'vscode';
import { FileExtensions, SettingsKeys } from '../../../core/constants';
import { B6PUri } from '../../../core/B6PUri';
import type { UpdateInfo } from '../../../core/update/types';
import type { UpdateService } from '../../../core/update/UpdateService';
import type { IFileSystem, ILogger } from '../../../core/providers';

/**
 * VS Code-specific UI wrapper for the UpdateService.
 * Handles all VS Code-specific UI interactions like notifications, webviews, and progress indicators.
 *
 * @lastreviewed null
 */
export class UpdateUI {
  constructor(
    private readonly updateService: UpdateService,
    private readonly fs: IFileSystem,
    private readonly logger: ILogger,
    private readonly extensionUri: vscode.Uri,
    private readonly globalStorageUri: vscode.Uri,
    _appKey: string
  ) {
    // Start automatic update check after a delay
    setTimeout(async () => {
      try {
        this.logger.info('B6P: Starting automatic update check...');
        await this.showVersionNotesIfNeeded();
        await this.checkForUpdatesAndNotify();
      } catch (error) {
        this.logger.error(`B6P: Update check failed: ${error instanceof Error ? error.stack : error}`);
      }
    }, 10_000); // Delay 10 seconds to allow other startup tasks to complete
  }

  /**
   * Check for version changes and show setup guide if needed.
   * @lastreviewed null
   */
  private async showVersionNotesIfNeeded(): Promise<void> {
    const versionInfo = await this.updateService.getVersionNotes();
    this.logger.info(`B6P: Stored version: ${versionInfo.storedVersion}, Current version: ${versionInfo.currentVersion}`);

    // TODO: Implement release notes display when version changes
    // This would show a webview or open a markdown file with release notes
  }

  /**
   * Check for updates and show notification if available.
   * @lastreviewed null
   */
  private async checkForUpdatesAndNotify(): Promise<void> {
    const updateInfo = await this.updateService.checkForUpdatesIfNeeded();
    if (updateInfo) {
      await this.showUpdateNotification(updateInfo);
    }
  }

  /**
   * Show update notification to user with action buttons.
   * @param updateInfo Information about the available update
   * @lastreviewed null
   */
  private async showUpdateNotification(updateInfo: UpdateInfo): Promise<void> {
    const message = `B6P Extension v${updateInfo.version} is available. You have v${this.updateService.getCurrentVersion()}.`;
    const Actions = {
      INSTALL: 'Install',
      VIEW_NOTES: 'View Release Notes',
      DISMISS: 'Dismiss'
    };
    const actions = [Actions.INSTALL, Actions.VIEW_NOTES, Actions.DISMISS];

    const selection = await vscode.window.showInformationMessage(message, ...actions);

    switch (selection) {
      case Actions.INSTALL:
        await this.autoInstallUpdate(updateInfo);
        break;
      case Actions.VIEW_NOTES:
        await this.showReleaseNotes(updateInfo);
        break;
      // Dismiss or no selection - do nothing
    }
  }

  /**
   * Manually check for updates with progress indicator.
   * Called by the "Check for Updates" command.
   *
   * @returns UpdateInfo if available, null otherwise
   * @lastreviewed null
   */
  async checkForUpdatesManually(): Promise<UpdateInfo | null> {
    return vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Checking for B6P updates...',
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 0 });
      progress.report({ increment: 50, message: 'Contacting GitHub...' });

      const updateInfo = await this.updateService.checkForUpdates();

      progress.report({ increment: 100 });

      if (!updateInfo) {
        await vscode.window.showInformationMessage('You are running the latest version of B6P Extension!');
      } else {
        await this.showUpdateNotification(updateInfo);
      }

      return updateInfo;
    });
  }

  /**
   * Automatically download and install the extension update.
   * @param updateInfo Information about the available update
   * @lastreviewed null
   */
  private async autoInstallUpdate(updateInfo: UpdateInfo): Promise<void> {
    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Installing B6P Extension v${updateInfo.version}`,
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 0, message: 'Downloading...' });

        // Check if the download URL is a .vsix file
        if (!updateInfo.downloadUrl.endsWith(FileExtensions.VSIX)) {
          throw new Error('Auto-install requires direct .vsix download link');
        }

        // Download the .vsix file
        progress.report({ increment: 30, message: 'Downloading extension...' });
        const vsixPath = await this.downloadVsixFile(updateInfo.downloadUrl, updateInfo.version);

        // Install the extension
        progress.report({ increment: 70, message: 'Installing extension...' });
        await this.installVsixFile(vsixPath);

        progress.report({ increment: 100, message: 'Installation complete!' });
      });

      // Prompt user to reload VS Code
      const reloadAction = 'Reload Now';
      const selection = await vscode.window.showInformationMessage(
        `B6P Extension v${updateInfo.version} has been installed successfully! Please reload VS Code to activate the new version.`,
        reloadAction,
        'Later'
      );

      if (selection === reloadAction) {
        await vscode.commands.executeCommand('workbench.action.reloadWindow');
      }

    } catch (error) {
      this.logger.error(`Auto-install failed: ${error instanceof Error ? error.message : error}`);
      vscode.window.showErrorMessage(
        `Failed to auto-install extension: ${error instanceof Error ? error.message : error}. Please download and install manually.`
      );
      // Fallback to opening download URL
      await this.openDownloadUrl(updateInfo.downloadUrl);
    }
  }

  /**
   * Download the .vsix file to a temporary location.
   * @param downloadUrl URL to download the .vsix file from
   * @param version Version string for temporary file naming
   * @returns Path to the downloaded .vsix file
   * @lastreviewed null
   */
  private async downloadVsixFile(downloadUrl: string, version: string): Promise<string> {
    try {
      // Use UpdateService to download the file
      const fileContent = await this.updateService.downloadFile(downloadUrl);

      // Create temporary file path
      const tempDir = this.globalStorageUri.fsPath;
      const tempFileName = `${SettingsKeys.APP_KEY}-${version}${FileExtensions.VSIX}`;
      const tempFilePath = vscode.Uri.joinPath(this.globalStorageUri, tempFileName);

      // Ensure the directory exists
      try {
        await this.fs.createDirectory(B6PUri.fromFsPath(tempDir));
      } catch {
        // Directory might already exist, ignore error
      }

      // Write the file
      await this.fs.writeFile(B6PUri.fromFsPath(tempFilePath.fsPath), fileContent);

      return tempFilePath.fsPath;

    } catch (error) {
      throw new Error(`Extension download error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Install a .vsix file using VS Code's extension API.
   * @param vsixPath Local file path to the .vsix file
   * @lastreviewed null
   */
  private async installVsixFile(vsixPath: string): Promise<void> {
    try {
      await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(vsixPath));
    } catch (error) {
      throw new Error(`Extension installation error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Open the download URL in default browser.
   * @param url The URL to open
   * @lastreviewed null
   */
  private async openDownloadUrl(url: string): Promise<void> {
    try {
      await vscode.env.openExternal(vscode.Uri.parse(url));
    } catch (error) {
      this.logger.error(`Failed to open download URL: ${error instanceof Error ? error.message : error}`);
      vscode.window.showErrorMessage('Failed to open download URL. Please visit the GitHub releases page manually.');
    }
  }

  /**
   * Show release notes in a webview panel.
   * @param updateInfo Information about the update including release notes
   * @lastreviewed null
   */
  private async showReleaseNotes(updateInfo: UpdateInfo): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'b6pReleaseNotes',
      `B6P Release Notes v${updateInfo.version}`,
      vscode.ViewColumn.One,
      {}
    );

    panel.webview.html = this.getReleaseNotesHtml(updateInfo);
  }

  /**
   * Generate HTML for release notes webview.
   * @param updateInfo Information about the update including release notes
   * @returns HTML string for the webview
   * @lastreviewed null
   */
  private getReleaseNotesHtml(updateInfo: UpdateInfo): string {
    const releaseNotes = updateInfo.releaseNotes
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Release Notes</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
          }
          h1 {
            color: var(--vscode-textPreformat-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
          }
          .meta {
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
            margin-bottom: 20px;
          }
          .download-link {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 3px;
            display: inline-block;
            margin-top: 20px;
          }
          .download-link:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
        </style>
      </head>
      <body>
        <h1>B6P Extension v${updateInfo.version}</h1>
        <div class="meta">
          Released: ${new Date(updateInfo.publishedAt).toLocaleDateString()}
        </div>
        <div class="content">
          ${releaseNotes || 'No release notes available.'}
        </div>
        <a href="${updateInfo.downloadUrl}" class="download-link">Download Update</a>
      </body>
      </html>
    `;
  }

  /**
   * Open the SETUP.md file in the editor (for first-time setup).
   * @param message Optional message to show in a notification
   * @lastreviewed null
   */
  async showSetupGuide(message?: string): Promise<void> {
    try {
      if (await this.updateService.hasShownSetup()) {
        return; // Already shown
      }

      const setupFilePath = vscode.Uri.joinPath(this.extensionUri, 'SETUP.md');

      // Open the setup guide
      const document = await vscode.workspace.openTextDocument(setupFilePath);
      await vscode.window.showTextDocument(document, {
        preview: false,
        viewColumn: vscode.ViewColumn.One
      });

      // Show optional notification
      if (message) {
        vscode.window.showInformationMessage(message);
      }

      await this.updateService.markSetupShown();
    } catch (error) {
      this.logger.error(`B6P: Failed to open setup guide: ${error instanceof Error ? error.message : error}`);
      // Don't throw - this is a nice-to-have feature
    }
  }

  /**
   * Dispose of resources.
   */
  dispose(): void {
    // No cleanup needed currently
  }
}
