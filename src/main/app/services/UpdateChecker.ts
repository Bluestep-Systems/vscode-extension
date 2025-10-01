import * as vscode from 'vscode';
import { ClientInfo, GithubRelease, UpdateInfo } from '../../../../types';
import type { App } from '../App';
import { ContextNode } from '../context/ContextNode';
import { FileSystem } from '../util/fs/FileSystem';
import { PrivateKeys, TypedPersistable } from '../util/PseudoMaps';
import { PrivateTypedPersistable } from '../util/PseudoMaps/TypedPrivatePersistable';
import { Err } from '../util/Err';
const fs = FileSystem.getInstance;
/**
 * Singleton update checker for the BlueStep VS Code extension.
 * Checks for new releases on GitHub and notifies users when updates are available.
 * @lastreviewed null
 */
export const UPDATE_MANAGER = new class extends ContextNode {
  private readonly LAST_CHECKED_KEY = 'lastChecked';
  private readonly UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  private readonly REPO_OWNER: string = 'bluestep-systems';
  private readonly REPO_NAME: string = 'vscode-extension';

  /**
   * The ancestor context node that is used to instantiate this manager
   */
  private _parent: typeof App | null = null;

  private _state: TypedPersistable<ClientInfo> | null = null;

  /**
   * Initializes the update checker, and also starts automatic update checking.
   * @param parent The ancestor context node that is used to instantiate this manager
   * @lastreviewed 2025-09-18
   */

  init(parent: typeof App): this {
    this._parent = parent;
    const version = parent.getVersion();
    this._state = new PrivateTypedPersistable<ClientInfo>({ key: PrivateKeys.GITHUB_STATE, context: this.context, defaultValue: { version, lastChecked: 0, githubToken: null } });
    setTimeout(async () => {
      try {
        console.log("B6P: Starting automatic update check...");
        await this.checkForUpdatesIfNeeded();
      } catch (error) {
        this.parent.logger.error("B6P: Update check failed: " + (error instanceof Error ? error.stack : error));
      }
    }, 5_000);
    return this;
  }

  
  public get parent(): typeof App {
    if (!this._parent) {
      throw new Err.ManagerNotInitializedError("UpdateChecker");
    }
    return this._parent;
  }

  
  public get context(): vscode.ExtensionContext {
    if (!this._parent) {
      throw new Err.ManagerNotInitializedError("UpdateChecker");
    }
    return this._parent.context;
  }

  /**
   * The Github information map for storing update check data
   */
  protected map(): TypedPersistable<ClientInfo> {
    return this.state;
  }

  /**
   * Gets the Client Information state, which represents things like version, last update, etc.
   */
  private get state(): TypedPersistable<ClientInfo> {
    if (!this._state) {
      throw new Err.ManagerNotInitializedError("UpdateChecker");
    }
    return this._state;
  }

  private async getGithubToken() {
    const token = this.state.get('githubToken');
    if (!token) {
      return vscode.window.showInputBox({
        prompt: 'A GitHub token is required: please enter it',
        placeHolder: 'ghp_XXXXXXXXXXXXXXXXXXXXXX'
      }).then(input => {
        if (input) {
          this.state.set('githubToken', input);
          return input;
        }
        throw new Err.GitHubTokenNotAvailableError();
      });
    }
    return token;
  }

  /**
   * Get GitHub authentication headers if token is available
   * @returns Headers object with authentication if configured
   * @lastreviewed null
   */
  private async getGitHubHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'User-Agent': 'B6P-VSCode-Extension',
      'Accept': 'application/vnd.github.v3+json'
    };

    const githubToken = await this.getGithubToken();
    if (!githubToken) {
      throw new Err.GitHubTokenNotAvailableError();
    }
    headers['Authorization'] = `Bearer ${githubToken}`;

    return headers;
  }

  /**
   * Check for updates if enough time has passed since last check
   * @lastreviewed null
   */
  public async checkForUpdatesIfNeeded(): Promise<void> {
    try {
      const updateCheck = this.parent.settings.get('updateCheck');
      const updateCheckEnabled = updateCheck.enabled;

      if (!updateCheckEnabled) {
        return;
      } else if (this.state.get('githubToken') === null) {
        vscode.window.showWarningMessage('B6P -- GitHub token not set. Update checking is disabled');
        return;
      }

      const lastCheck = this.state.get(this.LAST_CHECKED_KEY) || 0;
      const now = Date.now();

      if (now - lastCheck < this.UPDATE_INTERVAL) {
        return; // Not enough time has passed
      }

      await this.checkForUpdates();
      this.state.set(this.LAST_CHECKED_KEY, now);
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  }

  /**
   * Force check for updates regardless of timing
   * @returns UpdateInfo if a newer version is available, null otherwise
   * @lastreviewed null
   */
  public async checkForUpdates(): Promise<UpdateInfo | null> {
    try {
      const currentVersion = this.getCurrentVersion();
      const latestRelease = await this.getLatestRelease();

      if (!latestRelease) {
        return null;
      }

      const latestVersion = latestRelease.tag_name.replace(/^v/, ''); // Remove 'v' prefix if present

      if (this.isNewerVersion(latestVersion, currentVersion)) {
        const updateInfo: UpdateInfo = {
          version: latestVersion,
          downloadUrl: this.getDownloadUrl(latestRelease),
          releaseNotes: latestRelease.body,
          publishedAt: latestRelease.published_at
        };

        await this.notifyUser(updateInfo);
        return updateInfo;
      }

      return null;
    } catch (error) {
      console.error('Error checking for updates:', error);
      throw error;
    }
  }

  /**
   * Get current extension version from App singleton
   * @returns Current extension version string
   * @lastreviewed null
   */
  private getCurrentVersion(): string {
    return this.parent.getVersion();
  }

  /**
   * Get the latest release from GitHub API
   * @returns The latest non-draft, non-prerelease GitHub release or null if none found
   * @lastreviewed null
   */
  private async getLatestRelease(): Promise<GithubRelease | null> {
    try {
      const url = `https://api.github.com/repos/${this.REPO_OWNER}/${this.REPO_NAME}/releases/latest`;

      const response = await fetch(url, {
        method: 'GET',
        headers: await this.getGitHubHeaders(),
        signal: AbortSignal.timeout(10_000) // 10 second timeout
      });

      if (response.status === 404) {
        // No releases found
        return null;
      }

      if (!response.ok) {
        throw new Err.GitHubApiError(response.status);
      }

      const release = await response.json() as GithubRelease;

      // Filter out drafts and pre-releases by default
      if (release.draft || release.prerelease) {
        return null;
      }

      return release;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Err.UpdateCheckTimeoutError();
        }
        throw new Err.GraphQLFetchError(error.message);
      }
      throw new Err.DataParsingError(`Failed to parse GitHub API response: ${error}`);
    }
  }

  /**
   * Compare version strings to determine if newVersion is newer than currentVersion
   * @param newVersion The new version string to compare
   * @param currentVersion The current version string to compare against
   * @returns True if newVersion is newer than currentVersion
   * @lastreviewed null
   */
  private isNewerVersion(newVersion: string, currentVersion: string): boolean {
    const parseVersion = (version: string) => {
      return version.split('.').map(num => parseInt(num, 10));
    };

    const newParts = parseVersion(newVersion);
    const currentParts = parseVersion(currentVersion);

    // Ensure both arrays have the same length
    const maxLength = Math.max(newParts.length, currentParts.length);
    while (newParts.length < maxLength) {
      newParts.push(0);
    }
    while (currentParts.length < maxLength) {
      currentParts.push(0);
    }

    for (let i = 0; i < maxLength; i++) {
      if (newParts[i] > currentParts[i]) {
        return true;
      } else if (newParts[i] < currentParts[i]) {
        return false;
      }
    }

    return false; // Versions are equal
  }

  /**
   * Get download URL for the extension package from release assets
   * @param release The GitHub release object
   * @returns The download URL for the .vsix file or the release page
   * @lastreviewed null
   */
  private getDownloadUrl(release: GithubRelease): string {
    // Look for .vsix file in assets
    const vsixAsset = release.assets.find(asset => asset.name.endsWith('.vsix'));
    if (vsixAsset) {
      return vsixAsset.browser_download_url;
    }

    // Fallback to release page
    return `https://github.com/${this.REPO_OWNER}/${this.REPO_NAME}/releases/tag/${release.tag_name}`;
  }

    /**
   * Show update notification to user
   * @param updateInfo Information about the available update
   * @lastreviewed null
   */
  private async notifyUser(updateInfo: UpdateInfo): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.parent.appKey);
    const showNotifications = config.get<boolean>('updateCheck.showNotifications', true);

    if (!showNotifications) {
      return;
    }

    const message = `B6P Extension v${updateInfo.version} is available. You have v${this.getCurrentVersion()}.`;
    const Actions = {
      AUTO_INSTALL: "Auto Install",
      DOWNLOAD: "Download",
      VIEW_NOTES: "View Release Notes",
      REMIND_LATER: "Remind Later",
      DISABLE: "Disable Updates"
    };
    const actions = Object.values(Actions);

    const selection = await vscode.window.showInformationMessage(message, ...actions);

    switch (selection) {
      case Actions.AUTO_INSTALL:
        await this.autoInstallUpdate(updateInfo);
        break;
      case Actions.DOWNLOAD:
        await this.openDownloadUrl(updateInfo.downloadUrl);
        break;
      case Actions.VIEW_NOTES:
        await this.showReleaseNotes(updateInfo);
        break;
      case Actions.DISABLE:
        await this.disableUpdateChecking();
        break;
      // 'Remind Later' or no selection - do nothing
    }
  }

  /**
   * Automatically download and install the extension update
   * @param updateInfo Information about the available update
   * @lastreviewed null
   */
  private async autoInstallUpdate(updateInfo: UpdateInfo): Promise<void> {
    try {
      // Show progress notification
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Installing B6P Extension v${updateInfo.version}`,
        cancellable: false
      }, async (progress) => {
        progress.report({ increment: 0, message: "Downloading..." });

        // Check if the download URL is a .vsix file
        if (!updateInfo.downloadUrl.endsWith('.vsix')) {
          throw new Err.AutoInstallRequiresDirectLinkError();
        }

        // Download the .vsix file
        progress.report({ increment: 30, message: "Downloading extension..." });
        const vsixPath = await this.downloadVsixFile(updateInfo.downloadUrl, updateInfo.version);

        // Install the extension
        progress.report({ increment: 70, message: "Installing extension..." });
        await this.installVsixFile(vsixPath);

        progress.report({ increment: 100, message: "Installation complete!" });
      });

      // Prompt user to reload VS Code
      const reloadAction = "Reload Now";
      const selection = await vscode.window.showInformationMessage(
        `B6P Extension v${updateInfo.version} has been installed successfully! Please reload VS Code to activate the new version.`,
        reloadAction,
        "Later"
      );

      if (selection === reloadAction) {
        await vscode.commands.executeCommand('workbench.action.reloadWindow');
      }

    } catch (error) {
      console.error('Auto-install failed:', error);
      vscode.window.showErrorMessage(
        `Failed to auto-install extension: ${error instanceof Error ? error.message : error}. Please download and install manually.`
      );
      // Fallback to opening download URL
      await this.openDownloadUrl(updateInfo.downloadUrl);
    }
  }

  /**
   * Download the .vsix file to a temporary location
   * @param downloadUrl URL to download the .vsix file from
   * @param version Version string for temporary file naming
   * @returns Path to the downloaded .vsix file
   * @lastreviewed null
   */
  private async downloadVsixFile(downloadUrl: string, version: string): Promise<string> {
    try {
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'B6P-VSCode-Extension',
        },
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      if (!response.ok) {
        throw new Err.ExtensionDownloadError(response.status);
      }

      // Create temporary file path
      const tempDir = this.context.globalStorageUri.fsPath;
      const tempFileName = `bsjs-push-pull-${version}.vsix`;
      const tempFilePath = vscode.Uri.joinPath(this.context.globalStorageUri, tempFileName);

      // Ensure the directory exists
      try {
        await fs().createDirectory(vscode.Uri.file(tempDir));
      } catch {
        // Directory might already exist, ignore error
      }

      // Write the file
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      await fs().writeFile(tempFilePath, uint8Array);

      return tempFilePath.fsPath;

    } catch (error) {
      throw new Err.ExtensionDownloadError(500); // Generic download error
    }
  }

  /**
   * Install a .vsix file using VS Code's extension API
   * @param vsixPath Local file path to the .vsix file
   * @lastreviewed null
   */
  private async installVsixFile(vsixPath: string): Promise<void> {
    try {
      await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(vsixPath));
    } catch (error) {
      throw new Err.ExtensionInstallationError(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Open the download URL in default browser
   * @param url The URL to open
   * @lastreviewed null
   */
  private async openDownloadUrl(url: string): Promise<void> {
    try {
      await vscode.env.openExternal(vscode.Uri.parse(url));
    } catch (error) {
      console.error('Failed to open download URL:', error);
      vscode.window.showErrorMessage('Failed to open download URL. Please visit the GitHub releases page manually.');
    }
  }

  /**
   * Show release notes in a webview panel
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
   * Generate HTML for release notes webview
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
   * Disable automatic update checking
   * @lastreviewed null
   */
  private async disableUpdateChecking(): Promise<void> {
    const curUpdateSettings = this.parent.settings.get('updateCheck');
    this.parent.settings.set('updateCheck', { ...curUpdateSettings, ...{ enabled: false } });

    vscode.window.showInformationMessage(
      'Automatic update checking has been disabled. You can re-enable it in the extension settings.',
      'Open Settings'
    ).then(selection => {
      if (selection === 'Open Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', `${this.parent.appKey}.updateCheck`);
      }
    });
  }

  /**
   * Get all available releases (for manual checking)
   * @param includePrerelease Whether to include prerelease versions
   * @returns Array of GitHub releases
   * @lastreviewed null
   */
  public async getAllReleases(includePrerelease = false): Promise<GithubRelease[]> {
    try {
      const response = await fetch(`https://api.github.com/repos/${this.REPO_OWNER}/${this.REPO_NAME}/releases`, {
        method: 'GET',
        headers: await this.getGitHubHeaders(),
      });

      if (!response.ok) {
        throw new Err.GitHubApiError(response.status);
      }

      const releases = await response.json() as GithubRelease[];

      const filteredReleases = releases.filter(release => {
        if (release.draft) {
          return false;
        }
        if (!includePrerelease && release.prerelease) {
          return false;
        }
        return true;
      });

      return filteredReleases;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Err.UpdateCheckTimeoutError();
        }
        throw new Err.GraphQLFetchError(error.message);
      }
      throw new Err.DataParsingError(`Failed to parse GitHub API response: ${error}`);
    }
  }
}();
