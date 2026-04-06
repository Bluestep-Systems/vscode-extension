import * as vscode from 'vscode';
import { ClientInfo, GithubRelease, UpdateInfo } from '../../../../types';
import { FileExtensions, GitHubUrls, Http, SettingsKeys } from '../../../core/constants';
import { PrivateKeys, PrivateTypedPersistable } from '../../../core/persistence';
import type { IPersistence, ILogger } from '../../../core/providers';
import type { SettingsWrapper } from '../util/PseudoMaps/SettingsWrapper';
import { App } from '../App';
import { B6PUri } from '../../../core/B6PUri';

/**
 * Update checker for the BlueStep VS Code extension.
 * Checks for new releases on GitHub and notifies users when updates are available.
 * @lastreviewed null
 */
export class UpdateManager {
  private readonly LAST_CHECKED_KEY = 'lastChecked';
  private readonly UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  private readonly REPO_OWNER: string = 'bluestep-systems';
  private readonly REPO_NAME: string = 'vscode-extension';

  private readonly state: PrivateTypedPersistable<ClientInfo>;

  /**
   * Creates a new UpdateManager.
   *
   * @param persistence The persistence provider for storing update state
   * @param logger The logger for diagnostic output
   * @param settings The settings provider for configuration
   * @param extensionVersion The current extension version
   * @param extensionUri The extension's installation URI
   * @param globalStorageUri The global storage URI for temporary files
   * @param appKey The application settings key prefix
   * @lastreviewed null
   */
  constructor(
    persistence: IPersistence,
    private readonly logger: ILogger,
    private readonly settings: SettingsWrapper,
    private readonly extensionVersion: string,
    private readonly extensionUri: vscode.Uri,
    private readonly globalStorageUri: vscode.Uri,
    private readonly appKey: string
  ) {
    this.state = new PrivateTypedPersistable<ClientInfo>({
      key: PrivateKeys.GITHUB_STATE,
      persistence,
      defaultValue: { version: extensionVersion, lastChecked: 0, githubToken: null, setupShown: false }
    });

    setTimeout(async () => {
      try {
        this.logger.info("B6P: Starting automatic update check...");
        this.getVersionNotes(extensionVersion);
        await this.checkForUpdatesIfNeeded();
      } catch (error) {
        this.logger.error("B6P: Update check failed: " + (error instanceof Error ? error.stack : error));
      }
    }, 10_000); // Delay 10 seconds to allow other startup tasks to complete
  }

  /**
   * Checks if the extension version has changed (install or update) and shows setup guide
   * @param currentVersion The current version of the extension
   * @lastreviewed null
   */
  private getVersionNotes(currentVersion: string): void {
    const storedVersion = this.state.get('version');
    this.logger.info(`B6P: Stored version: ${storedVersion}, Current version is ${currentVersion}`);
    //TODO implement release notes display
  }

  /**
   * Opens the SETUP.md file in the editor
   * @param message Optional message to show in a notification
   * @lastreviewed null
   */
  //@ts-ignore
  private async showSetupGuide(message?: string): Promise<void> {
    try {
      if (this.state.get('setupShown')) {
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
      this.state.set('setupShown', true);
      await this.state.store();
    } catch (error) {
      this.logger.error(`B6P: Failed to open setup guide: ${error instanceof Error ? error.message : error}`);
      // Don't throw - this is a nice-to-have feature
    }
  }

  /**
   * Get GitHub authentication headers if token is available
   * @returns Headers object with authentication if configured
   * @lastreviewed 2025-10-15
   */
  private async getGitHubHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      [Http.Headers.USER_AGENT]: Http.Headers.USER_AGENT_B6P,
      [Http.Headers.ACCEPT]: Http.Headers.GITHUB_API_ACCEPT
    };

    return headers;
  }

  /**
   * Check for updates if enough time has passed since last check
   * @lastreviewed null
   */
  public async checkForUpdatesIfNeeded(): Promise<void> {
    try {
      const updateCheck = this.settings.get('updateCheck');
      const updateCheckEnabled = updateCheck.enabled;

      if (!updateCheckEnabled) {
        return;
      }

      const lastCheck = this.state.get(this.LAST_CHECKED_KEY) || 0;
      const now = Date.now();

      if (now - lastCheck < this.UPDATE_INTERVAL) {
        this.logger.info("B6P: Skipping update check - not enough time has passed since last check.");
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
   * @lastreviewed 2025-10-15
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

        await this.notifyUserAndInstallUpdate(updateInfo);
        return updateInfo;
      }

      return null;
    } catch (error) {
      console.error('Error checking for updates:', error);
      throw error;
    }
  }

  /**
   * Get current extension version
   * @returns Current extension version string
   * @lastreviewed 2025-10-15
   */
  private getCurrentVersion(): string {
    const debugMode = this.settings.get('debugMode');
    if (debugMode.enabled && debugMode.versionOverride) {
      this.logger.info(`B6P: Using debug mode version override: ${debugMode.versionOverride}`);
      return debugMode.versionOverride;
    }
    return this.extensionVersion;
  }

  /**
   * Get the latest release from GitHub API
   * @returns The latest non-draft, non-prerelease GitHub release or null if none found
   * @lastreviewed 2025-10-15
   */
  private async getLatestRelease(): Promise<GithubRelease | null> {
    try {
      const url = `${GitHubUrls.API_BASE}${GitHubUrls.REPOS_PATH}${this.REPO_OWNER}/${this.REPO_NAME}${GitHubUrls.RELEASES_LATEST_PATH}`;

      const response = await fetch(url, {
        method: Http.Methods.GET,
        headers: await this.getGitHubHeaders(),
        signal: AbortSignal.timeout(10_000) // 10 second timeout
      });

      if (response.status === 404) {
        // No releases found
        return null;
      }

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
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
          throw new Error('Update check timeout');
        }
        throw new Error(`GraphQL fetch error: ${error.message}`);
      }
      throw new Error(`Failed to parse GitHub API response: ${error}`);
    }
  }

  /**
   * Compare version strings to determine if newVersion is newer than currentVersion
   * @param newVersion The new version string to compare
   * @param currentVersion The current version string to compare against
   * @returns True if newVersion is newer than currentVersion
   * @lastreviewed 2025-10-15
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
   * @lastreviewed 2025-10-15
   */
  private getDownloadUrl(release: GithubRelease): string {
    // Look for .vsix file in assets
    const vsixAsset = release.assets.find(asset => asset.name.endsWith(FileExtensions.VSIX));
    if (vsixAsset) {
      return vsixAsset.browser_download_url;
    }

    // Fallback to release page
    return `${GitHubUrls.BASE}/${this.REPO_OWNER}/${this.REPO_NAME}/releases/tag/${release.tag_name}`;
  }

  /**
   * Show update notification to user
   * @param updateInfo Information about the available update
   * @lastreviewed 2025-10-15
   */
  private async notifyUserAndInstallUpdate(updateInfo: UpdateInfo): Promise<void> {
    const config = this.settings;
    const showNotifications = config.get('updateCheck').showNotifications;

    if (!showNotifications) {
      return;
    }

    const message = `B6P Extension v${updateInfo.version} is available. You have v${this.getCurrentVersion()}.`;
    const Actions = {
      INSTALL: "Install",
      VIEW_NOTES: "View Release Notes",
      DISABLE: "Disable Auto-Check"
    };
    const actions = Object.values(Actions);

    const selection = await vscode.window.showInformationMessage(message, ...actions);

    switch (selection) {
      case Actions.INSTALL:
        await this.autoInstallUpdate(updateInfo);
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
   * @lastreviewed 2025-10-15
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
        if (!updateInfo.downloadUrl.endsWith(FileExtensions.VSIX)) {
          throw new Error('Auto-install requires direct .vsix download link');
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
        await this.state.set('version', updateInfo.version);
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
   * @lastreviewed 2025-10-15
   */
  private async downloadVsixFile(downloadUrl: string, version: string): Promise<string> {
    try {
      const response = await fetch(downloadUrl, {
        method: Http.Methods.GET,
        headers: {
          [Http.Headers.USER_AGENT]: Http.Headers.USER_AGENT_B6P,
        },
        signal: AbortSignal.timeout(30_000) // 30 second timeout
      });

      if (!response.ok) {
        throw new Error(`Extension download error: ${response.status}`);
      }

      // Create temporary file path
      const tempDir = this.globalStorageUri.fsPath;
      const tempFileName = `${SettingsKeys.APP_KEY}-${version}${FileExtensions.VSIX}`;
      const tempFilePath = vscode.Uri.joinPath(this.globalStorageUri, tempFileName);

      // Ensure the directory exists
      try {
        await App.core.fs.createDirectory(B6PUri.fromFsPath(tempDir));
      } catch {
        // Directory might already exist, ignore error
      }

      // Write the file
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      await App.core.fs.writeFile(B6PUri.fromFsPath(tempFilePath.fsPath), uint8Array);

      return tempFilePath.fsPath;

    } catch (error) {
      throw new Error('Extension download error: 500'); // Generic download error
    }
  }

  /**
   * Install a .vsix file using VS Code's extension API
   * @param vsixPath Local file path to the .vsix file
   * @lastreviewed 2025-10-15
   */
  private async installVsixFile(vsixPath: string): Promise<void> {
    try {
      await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(vsixPath));
    } catch (error) {
      throw new Error(`Extension installation error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Open the download URL in default browser
   * @param url The URL to open
   * @lastreviewed 2025-10-15
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
   * @lastreviewed 2025-10-15
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
   * @lastreviewed 2025-10-15
   */
  private async disableUpdateChecking(): Promise<void> {
    const curUpdateSettings = this.settings.get('updateCheck');
    this.settings.set('updateCheck', { ...curUpdateSettings, ...{ enabled: false } });

    vscode.window.showInformationMessage(
      'Automatic update checking has been disabled. You can re-enable it in the extension settings.',
      'Open Settings'
    ).then(selection => {
      if (selection === 'Open Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', `${this.appKey}.updateCheck`);
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
      const response = await fetch(`${GitHubUrls.API_BASE}${GitHubUrls.REPOS_PATH}${this.REPO_OWNER}/${this.REPO_NAME}${GitHubUrls.RELEASES_PATH}`, {
        method: Http.Methods.GET,
        headers: await this.getGitHubHeaders(),
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
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
          throw new Error('Update check timeout');
        }
        throw new Error(`GraphQL fetch error: ${error.message}`);
      }
      throw new Error(`Failed to parse GitHub API response: ${error}`);
    }
  }

  /**
   * Dispose of resources.
   */
  dispose(): void {
    // No cleanup needed currently
  }
}
