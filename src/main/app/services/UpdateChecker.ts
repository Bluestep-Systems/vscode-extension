import * as vscode from 'vscode';
import { ContextNode } from '../context/ContextNode';
import { PrivateKeys, PrivatePersistanceMap } from '../util/data/PseudoMaps';
import { SavableObject, ReleaseInfo, GithubRelease } from '../../../../types';
import { App } from '../App';
import { Alert } from '../util/ui/Alert';



/**
 * Singleton update checker for the BlueStep VS Code extension.
 * Checks for new releases on GitHub and notifies users when updates are available.
 * @lastreviewed null
 */
export const UPDATE_MANAGER = new class extends ContextNode {
  private readonly UPDATE_CHECK_KEY = 'bsjs-lastUpdateCheck';
  private readonly UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  private readonly repoOwner: string = 'bluestep-systems';
  private readonly repoName: string = 'vscode-extension';
  
  /**
   * The ancestor context node that is used to instantiate this manager
   */
  #parent: typeof App | null = null;

  #tokenMap: PrivatePersistanceMap<SavableObject> | null = null;  

  /**
   * Initializes the update checker, and also starts automatic update checking.
   * @param parent The ancestor context node that is used to instantiate this manager
   * @lastreviewed 2025-09-18
   */

  init(parent: typeof App): this {
    this.#parent = parent;

    this.#tokenMap = new PrivatePersistanceMap<SavableObject>(PrivateKeys.GITHUB_KEYS, this.context);
    // Start automatic update checking (async, don't block startup)
    setTimeout(async () => {
      try {
        console.log("B6P: Starting automatic update check...");
        await this.checkForUpdatesIfNeeded();
      } catch (error) {
        App.isDebugMode() && Alert.error("B6P: Update check failed: " + (error instanceof Error ? error.stack : error));
        App.logger.error("B6P: Update check failed:");
      }
    }, 5000); 
    return this;
  }

  public get parent(): typeof App {
    if (!this.#parent) {
      throw new Error("UpdateChecker not initialized");
    }
    return this.#parent;
  }

  public get context(): vscode.ExtensionContext {
    if (!this.#parent) {
      throw new Error("UpdateChecker not initialized");
    }
    return this.#parent.context;
  }


  protected map(): PrivatePersistanceMap<SavableObject> {
    // Use the parent's settings for storing update check data
    if (!this.parent) {
      throw new Error("UpdateChecker not initialized");
    }
    return (this.parent as any).settings;
  }

  /**
   * Gets the token map for storing GitHub tokens.
   */
  private getTokenMap(): PrivatePersistanceMap<SavableObject> {
    if (!this.#tokenMap) {
      throw new Error("UpdateChecker not initialized!");
    }
    return this.#tokenMap;
  }

  //@ts-ignore
  private getDefaultToken(): string | null {
    const token = this.getTokenMap().get('githubToken') as string | undefined;
    return token || null;
  }

  /**
   * Get GitHub authentication headers if token is available
   * @returns Headers object with authentication if configured
   * @lastreviewed null
   */
  private getGitHubHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': 'B6P-VSCode-Extension',
      'Accept': 'application/vnd.github.v3+json'
    };

    // Check for GitHub token in VS Code settings
    const config = vscode.workspace.getConfiguration('bsjs-push-pull');
    const githubToken = config.get<string>('updateCheck.githubToken');

    if (githubToken) {
      headers['Authorization'] = `Bearer ${githubToken}`;
    }

    return headers;
  }

  /**
   * Check for updates if enough time has passed since last check
   * @lastreviewed null
   */
  public async checkForUpdatesIfNeeded(): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration(App.appKey);
      const updateCheckEnabled = config.get<boolean>('updateCheck.enabled', true);

      if (!updateCheckEnabled) {
        return;
      }

      const lastCheck = (this.map().get(this.UPDATE_CHECK_KEY) as number) || 0;
      const now = Date.now();

      if (now - lastCheck < this.UPDATE_INTERVAL) {
        return; // Not enough time has passed
      }

      await this.checkForUpdates();
      this.map().set(this.UPDATE_CHECK_KEY, now);
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  }

  /**
   * Force check for updates regardless of timing
   * @returns UpdateInfo if a newer version is available, null otherwise
   * @lastreviewed null
   */
  public async checkForUpdates(): Promise<ReleaseInfo | null> {
    try {
      const currentVersion = this.getCurrentVersion();
      const latestRelease = await this.getLatestRelease();

      if (!latestRelease) {
        return null;
      }

      const latestVersion = latestRelease.tag_name.replace(/^v/, ''); // Remove 'v' prefix if present

      if (this.isNewerVersion(latestVersion, currentVersion)) {
        const updateInfo: ReleaseInfo = {
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
   * Get current extension version from VS Code extension context
   * @returns Current extension version string
   * @lastreviewed null
   */
  private getCurrentVersion(): string {
    // Get version from the extension's package.json via VS Code API
    const extension = vscode.extensions.getExtension('bluestep-systems.bsjs-push-pull');
    return extension?.packageJSON?.version || (() => { throw new Error('Failed to get current version'); })();
  }

  /**
   * Get the latest release from GitHub API
   * @returns The latest non-draft, non-prerelease GitHub release or null if none found
   * @lastreviewed null
   */
  private async getLatestRelease(): Promise<GithubRelease | null> {
    try {
      const url = `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases/latest`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getGitHubHeaders(),
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (response.status === 404) {
        // No releases found
        return null;
      }

      if (!response.ok) {
        throw new Error(`GitHub API returned status ${response.status}`);
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
          throw new Error('Update check request timed out');
        }
        throw new Error(`Failed to check for updates: ${error.message}`);
      }
      throw new Error(`Failed to parse GitHub API response: ${error}`);
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
    return `https://github.com/${this.repoOwner}/${this.repoName}/releases/tag/${release.tag_name}`;
  }

  /**
   * Show update notification to user
   * @param updateInfo Information about the available update
   * @lastreviewed null
   */
  private async notifyUser(updateInfo: ReleaseInfo): Promise<void> {
    const config = vscode.workspace.getConfiguration('bsjs-push-pull');
    const showNotifications = config.get<boolean>('updateCheck.showNotifications', true);

    if (!showNotifications) {
      return;
    }

    const message = `B6P Extension v${updateInfo.version} is available. You have v${this.getCurrentVersion()}.`;
    const actions = ['Download', 'View Release Notes', 'Remind Later', 'Disable Updates'];

    const selection = await vscode.window.showInformationMessage(message, ...actions);

    switch (selection) {
      case 'Download':
        await this.openDownloadUrl(updateInfo.downloadUrl);
        break;
      case 'View Release Notes':
        await this.showReleaseNotes(updateInfo);
        break;
      case 'Disable Updates':
        await this.disableUpdateChecking();
        break;
      // 'Remind Later' or no selection - do nothing
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
  private async showReleaseNotes(updateInfo: ReleaseInfo): Promise<void> {
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
  private getReleaseNotesHtml(updateInfo: ReleaseInfo): string {
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
    const config = vscode.workspace.getConfiguration('bsjs-push-pull');
    await config.update('updateCheck.enabled', false, vscode.ConfigurationTarget.Global);

    vscode.window.showInformationMessage(
      'Automatic update checking has been disabled. You can re-enable it in the extension settings.',
      'Open Settings'
    ).then(selection => {
      if (selection === 'Open Settings') {
        vscode.commands.executeCommand('workbench.action.openSettings', 'bsjs-push-pull.updateCheck');
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
      const response = await fetch(`https://api.github.com/repos/bluestep-systems/vscode-extension/releases`, {
        method: 'GET',
        headers: this.getGitHubHeaders(),
        
      });

      if (!response.ok) {
        throw new Error(`GitHub API returned status ${response.status}`);
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
          throw new Error('Releases fetch request timed out');
        }
        throw new Error(`Failed to fetch releases: ${error.message}`);
      }
      throw new Error(`Failed to parse GitHub API response: ${error}`);
    }
  }
}();
