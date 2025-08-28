import * as vscode from 'vscode';
import * as https from 'https';

export interface UpdateInfo {
  version: string;
  downloadUrl: string;
  releaseNotes: string;
  publishedAt: string;
}

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
  prerelease: boolean;
  draft: boolean;
}

export class UpdateChecker {
  private static readonly UPDATE_CHECK_KEY = 'bsjs-lastUpdateCheck';
  private static readonly UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  
  constructor(
    private context: vscode.ExtensionContext,
    private repoOwner: string = 'bluestep-systems',
    private repoName: string = 'vscode-extension'
  ) {}

  /**
   * Check for updates if enough time has passed since last check
   */
  public async checkForUpdatesIfNeeded(): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration('bsjs-push-pull');
      const updateCheckEnabled = config.get<boolean>('updateCheck.enabled', true);
      
      if (!updateCheckEnabled) {
        return;
      }

      const lastCheck = this.context.globalState.get<number>(UpdateChecker.UPDATE_CHECK_KEY, 0);
      const now = Date.now();
      
      if (now - lastCheck < UpdateChecker.UPDATE_INTERVAL) {
        return; // Not enough time has passed
      }

      await this.checkForUpdates();
      await this.context.globalState.update(UpdateChecker.UPDATE_CHECK_KEY, now);
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  }

  /**
   * Force check for updates regardless of timing
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
   * Get the latest release from GitHub API
   */
  private async getLatestRelease(): Promise<GitHubRelease | null> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${this.repoOwner}/${this.repoName}/releases/latest`,
        method: 'GET',
        headers: {
          'User-Agent': 'B6P-VSCode-Extension',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode === 404) {
              // No releases found
              resolve(null);
              return;
            }

            if (res.statusCode !== 200) {
              reject(new Error(`GitHub API returned status ${res.statusCode}`));
              return;
            }

            const release: GitHubRelease = JSON.parse(data);
            
            // Filter out drafts and pre-releases by default
            if (release.draft || release.prerelease) {
              resolve(null);
              return;
            }

            resolve(release);
          } catch (error) {
            reject(new Error(`Failed to parse GitHub API response: ${error}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Failed to check for updates: ${error.message}`));
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Update check request timed out'));
      });

      req.end();
    });
  }

  /**
   * Get current extension version from VS Code extension context
   */
  private getCurrentVersion(): string {
    // Get version from the extension's package.json via VS Code API
    const extension = vscode.extensions.getExtension('bluestep-systems.bsjs-push-pull');
    return extension?.packageJSON?.version || '0.0.1';
  }

  /**
   * Compare version strings to determine if newVersion is newer than currentVersion
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
   */
  private getDownloadUrl(release: GitHubRelease): string {
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
   */
  private async notifyUser(updateInfo: UpdateInfo): Promise<void> {
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
   */
  public async getAllReleases(includePrerelease = false): Promise<GitHubRelease[]> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${this.repoOwner}/${this.repoName}/releases`,
        method: 'GET',
        headers: {
          'User-Agent': 'B6P-VSCode-Extension',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              reject(new Error(`GitHub API returned status ${res.statusCode}`));
              return;
            }

            const releases: GitHubRelease[] = JSON.parse(data);
            
            const filteredReleases = releases.filter(release => {
              if (release.draft) {
                return false;
              }
              if (!includePrerelease && release.prerelease) {
                return false;
              }
              return true;
            });

            resolve(filteredReleases);
          } catch (error) {
            reject(new Error(`Failed to parse GitHub API response: ${error}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Failed to fetch releases: ${error.message}`));
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Releases fetch request timed out'));
      });

      req.end();
    });
  }
}
