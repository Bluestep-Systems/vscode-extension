import * as path from 'path';
import { Http } from '../../../resources/constants';
import { MimeTypes } from '../../../resources/constants/MimeTypes';
import { App } from '../../App';
import { Err } from '../Err';
import { B6PUri } from '../../../../core/B6PUri';
import type { ScriptRoot } from './ScriptRoot';

/**
 * Text file extensions that should have their content included in history snapshots.
 */
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.scss',
  '.html', '.htm', '.xml', '.svg', '.txt', '.yaml', '.yml',
]);

/**
 * Records snapshot history by writing a history entry to the script's object map
 * via a GraphQL mutation. This makes snapshots taken from VS Code appear in the
 * browser IDE's "Project History" view.
 */
export class SnapshotHistoryRecorder {

  /**
   * Records a snapshot history entry for the given script.
   *
   * @param scriptRoot The script root to record history for
   * @param message The commit message (may be empty string)
   */
  static async record(scriptRoot: ScriptRoot, message: string): Promise<void> {
    const scriptKey = await scriptRoot.getScriptKey();
    const mutationName = scriptKey.mutationName;
    const inputType = scriptKey.inputType;

    if (!mutationName || !inputType) {
      App.logger.warn(`No GraphQL mutation known for classid ${scriptKey.classid}; skipping history recording.`);
      return;
    }

    const author = await this.getAuthor();
    const saveState = await this.buildSaveState(scriptRoot);
    const historyKey = JSON.stringify({
      author,
      timestamp: new Date().toISOString(),
      message: message || undefined,
    });
    const historyValue = JSON.stringify(saveState);
    const draftValue = JSON.stringify({ ...saveState, settings: this.stripContent(saveState.settings) });

    const origin = await scriptRoot.anyOrigin();
    const gqlUrl = new URL('gql', origin);

    const query = `mutation Snapshot($inputs: [${inputType}!]!) { ${mutationName}(inputs: $inputs) { id } }`;
    const variables = {
      inputs: [{
        topId: scriptKey.toCompoundId(),
        draft: draftValue,
        addMapObjectEntries: [{ key: historyKey, value: historyValue }],
      }],
    };

    App.logger.info(`Recording snapshot history for ${scriptKey.toCompoundId()}`);

    const response = await App.sessionManager.csrfFetch(gqlUrl, {
      method: Http.Methods.POST,
      headers: {
        [Http.Headers.CONTENT_TYPE]: MimeTypes.APPLICATION_JSON,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Err.HttpResponseError(`Failed to record snapshot history: ${response.status} ${text}`);
    }

    const json = await response.json() as { errors?: { message: string }[] };
    if (json.errors?.length) {
      throw new Err.HttpResponseError(`GraphQL errors recording snapshot history: ${json.errors.map(e => e.message).join(', ')}`);
    }

    App.logger.info('Snapshot history recorded successfully.');
  }

  /**
   * Gets the current user's username for the history author field.
   */
  private static async getAuthor(): Promise<string> {
    try {
      const auth = await App.authManager.getAuthObject(undefined, false);
      return auth.sObj.username;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Builds the hydrated save state object containing all file contents from the draft folder.
   * This mirrors the structure that BSJS creates in `#hydrateContentForHistory`.
   */
  private static async buildSaveState(scriptRoot: ScriptRoot): Promise<SaveState> {
    const draftFolder = scriptRoot.getDraftFolder();
    const allNodes = await draftFolder.flatten();
    const draftRootPath = draftFolder.uri().fsPath;
    const settings: Record<string, FileSetting | FolderSetting> = {};

    for (const node of allNodes) {
      const relativePath = '/' + path.relative(draftRootPath, node.path()).replace(/\\/g, '/');

      if (await node.isInItsRespectiveBuildFolder()) {
        continue;
      }

      if (await node.isFolder()) {
        const folderPath = relativePath.endsWith('/') ? relativePath : relativePath + '/';
        settings[folderPath] = {};
      } else {
        const ext = path.extname(node.path()).toLowerCase();
        if (TEXT_EXTENSIONS.has(ext)) {
          try {
            const bytes = await App.core.fs.readFile(B6PUri.fromFsPath(node.uri().fsPath));
            const content = Buffer.from(bytes).toString('utf-8');
            settings[relativePath] = { content };
          } catch (e) {
            App.logger.warn(`Failed to read file for history: ${node.path()}: ${e}`);
          }
        }
      }
    }

    return {
      version: 1, // this is hardcoded in bsjs, too. remove?
      isSnapshot: true,
      settings,
    };
  }

  /**
   * Returns a copy of settings with `content` stripped out — used for the `draft` field,
   * which stores metadata but not the full file contents.
   */
  private static stripContent(settings: Record<string, FileSetting | FolderSetting>): Record<string, Omit<FileSetting, 'content'> | FolderSetting> {
    const stripped: Record<string, object> = {};
    for (const [key, value] of Object.entries(settings)) {
      if ('content' in value) {
        const { content, ...rest } = value;
        stripped[key] = rest;
      } else {
        stripped[key] = value;
      }
    }
    return stripped;
  }
}

interface FileSetting {
  content?: string;
}

interface FolderSetting {
  // empty object for folder entries, matching BSJS convention
}

interface SaveState {
  version: number;
  isSnapshot: boolean;
  settings: Record<string, FileSetting | FolderSetting>;
}
