import * as crypto from 'crypto';
import * as path from 'path';
import { FolderNames, Http, MimeTypes, SpecialFiles } from './constants';
import { Err } from './Err';
import { B6PUri } from './B6PUri';
import { GlobMatcher } from './data/GlobMatcher';
import type { SessionManager } from './session/SessionManager';
import type { IFileSystem, ILogger, IProgress, IPrompt, ProgressTask } from './providers';

interface PushableFile {
  /** Absolute local path */
  localPath: string;
  /** Upstairs URL to PUT to */
  upstairsUrl: string;
  /** Local file content */
  content: Uint8Array;
}

/**
 * Recursively collect all files under a directory.
 */
async function flattenDirectory(dirPath: string, fs: IFileSystem): Promise<string[]> {
  const results: string[] = [];
  const entries = await fs.readDirectory(B6PUri.fromFsPath(dirPath));
  for (const [name, type] of entries) {
    const full = path.join(dirPath, name);
    if (type === 'directory') {
      const nested = await flattenDirectory(full, fs);
      results.push(...nested);
    } else {
      results.push(full);
    }
  }
  return results;
}

/**
 * Read .gitignore patterns from the script root.
 */
async function readGitIgnorePatterns(rootPath: string, fs: IFileSystem): Promise<string[]> {
  const gitignorePath = path.join(rootPath, SpecialFiles.GITIGNORE);
  const uri = B6PUri.fromFsPath(gitignorePath);
  try {
    const raw = await fs.readFile(uri);
    const text = Buffer.from(raw).toString('utf-8');
    return text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'));
  } catch {
    return ['**/.DS_Store'];
  }
}

/**
 * Compute the SHA-512 hash of a buffer.
 */
function sha512(data: Uint8Array): string {
  return crypto.createHash('sha512').update(data).digest('hex').toLowerCase();
}

/**
 * Determine whether a file should be excluded from push.
 */
function shouldExclude(
  filePath: string,
  rootPath: string,
  _draftPath: string,
  gitignoreMatcher: GlobMatcher,
  isSnapshot: boolean,
): string | null {
  const relative = path.relative(rootPath, filePath);
  const segments = relative.split(path.sep);

  // Not in draft folder
  if (segments[0] !== FolderNames.DRAFT) {
    return 'Not in draft folder';
  }

  // In declarations folder (declarations are never pushed)
  if (segments[1] === FolderNames.DECLARATIONS) {
    return 'In declarations folder';
  }

  // In .git folder
  if (segments.includes('.git')) {
    return 'In .git folder';
  }

  // Check gitignore
  if (gitignoreMatcher.matches(filePath)) {
    return 'Matched .gitignore pattern';
  }

  // Skip build folder contents unless snapshot
  if (!isSnapshot && segments.includes(FolderNames.DOT_BUILD)) {
    return 'In build folder (non-snapshot)';
  }

  return null;
}

/**
 * Build the upstairs URL for a draft file.
 */
function buildUpstairsUrl(filePath: string, draftPath: string, baseUrl: string, isSnapshot: boolean): string {
  let relative = path.relative(draftPath, filePath);
  // Normalize to forward slashes for URL
  relative = relative.split(path.sep).join('/');

  const base = new URL(baseUrl);

  if (isSnapshot) {
    base.pathname = base.pathname + FolderNames.SNAPSHOT + '/' + relative;
  } else {
    base.pathname = base.pathname + FolderNames.DRAFT + '/' + relative;
  }

  return base.href;
}

/**
 * Core push implementation.
 */
export async function executePush(opts: {
  targetUrl: string;
  rootPath: string;
  snapshot: boolean;
  session: SessionManager;
  fs: IFileSystem;
  prompt: IPrompt;
  logger: ILogger;
  progress: IProgress;
}): Promise<void> {
  const { targetUrl, rootPath, snapshot, session, fs, prompt, logger, progress } = opts;
  const draftPath = path.join(rootPath, FolderNames.DRAFT);

  // Check draft folder exists
  const draftUri = B6PUri.fromFsPath(draftPath);
  if (!(await fs.exists(draftUri))) {
    prompt.error(`Draft folder not found: ${draftPath}`);
    return;
  }

  // Read gitignore
  const gitignorePatterns = await readGitIgnorePatterns(rootPath, fs);
  const gitignoreMatcher = new GlobMatcher(rootPath, gitignorePatterns);

  // Flatten draft directory
  const allFiles = await flattenDirectory(draftPath, fs);
  logger.info(`Found ${allFiles.length} files in draft folder`);

  // Filter to pushable files
  const pushable: PushableFile[] = [];
  for (const filePath of allFiles) {
    const reason = shouldExclude(filePath, rootPath, draftPath, gitignoreMatcher, snapshot);
    if (reason) {
      logger.info(`Excluding: ${filePath} (${reason})`);
      continue;
    }

    const content = await fs.readFile(B6PUri.fromFsPath(filePath));
    const localHash = sha512(content);

    // Check if file has changed on server since last push (integrity check)
    const upstairsUrl = buildUpstairsUrl(filePath, draftPath, targetUrl, false);
    if (!snapshot) {
      try {
        const headResp = await session.fetch(upstairsUrl, { method: Http.Methods.HEAD });
        const etag = headResp.headers.get(Http.Headers.ETAG);
        if (etag) {
          const serverHash = etag.replace(/^W\//, '').replace(/"/g, '').toLowerCase();
          // If local matches server, skip
          if (localHash === serverHash) {
            logger.info(`File integrity matches, skipping: ${filePath}`);
            continue;
          }
        }
      } catch {
        // File may not exist upstairs yet — that's fine, push it
      }
    }

    const finalUrl = buildUpstairsUrl(filePath, draftPath, targetUrl, snapshot);
    pushable.push({ localPath: filePath, upstairsUrl: finalUrl, content });
  }

  if (pushable.length === 0) {
    prompt.info('No files to push — everything is in sync.');
    return;
  }

  logger.info(`Pushing ${pushable.length} file(s)`);

  // Execute push tasks
  const pushTasks: ProgressTask<Response>[] = pushable.map(file => ({
    execute: async () => {
      const resp = await session.csrfFetch(file.upstairsUrl, {
        method: Http.Methods.PUT,
        headers: { [Http.Headers.CONTENT_TYPE]: MimeTypes.APPLICATION_JSON },
        body: file.content,
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Err.FileSendError(`\nStatus: ${resp.status}\n${text}`);
      }

      // If snapshot, also push to snapshot folder
      if (snapshot) {
        const draftUrl = buildUpstairsUrl(file.localPath, draftPath, targetUrl, false);
        const draftResp = await session.csrfFetch(draftUrl, {
          method: Http.Methods.PUT,
          headers: { [Http.Headers.CONTENT_TYPE]: MimeTypes.APPLICATION_JSON },
          body: file.content,
        });
        if (!draftResp.ok) {
          logger.warn(`Snapshot draft-copy failed for ${file.localPath}: ${draftResp.status}`);
        }
      }

      return resp;
    },
    description: path.basename(file.localPath),
  }));

  await progress.withProgress(pushTasks, {
    title: snapshot ? 'Pushing Snapshot...' : 'Pushing Script...',
    showItemCount: true,
    cleanupMessage: 'Cleaning up...',
  });

  // Cleanup: delete unused upstairs paths
  await cleanupUnusedUpstairsPaths({
    targetUrl,
    rootPath,
    draftPath,
    snapshot,
    session,
    fs,
    prompt,
    logger,
    gitignoreMatcher,
  });

  prompt.info(snapshot ? 'Snapshot complete!' : 'Push complete!');
}

/**
 * Delete remote files that no longer have a local counterpart.
 */
async function cleanupUnusedUpstairsPaths(opts: {
  targetUrl: string;
  rootPath: string;
  draftPath: string;
  snapshot: boolean;
  session: SessionManager;
  fs: IFileSystem;
  prompt: IPrompt;
  logger: ILogger;
  gitignoreMatcher: GlobMatcher;
}): Promise<void> {
  const { targetUrl, draftPath, session, fs, prompt, logger, gitignoreMatcher } = opts;

  // We need a parser to list what's upstairs
  // For now, use a lightweight PROPFIND approach
  try {
    const { XMLParser } = await import('fast-xml-parser');
    const parser = new XMLParser();

    const response = await session.fetch(targetUrl, {
      headers: {
        [Http.Headers.ACCEPT]: Http.Headers.ACCEPT_ALL,
        [Http.Headers.CACHE_CONTROL]: Http.Headers.NO_CACHE,
      },
      method: Http.Methods.PROPFIND,
    });

    if (!response.ok) {
      logger.warn(`PROPFIND failed during cleanup: ${response.status}`);
      return;
    }

    const xml = await response.text();
    const parsed = parser.parse(xml);
    const responses = parsed?.['D:multistatus']?.['D:response'];
    if (!responses?.filter) {
      return;
    }

    // Build set of local draft paths (relative to draft folder)
    const localFiles = await flattenDirectory(draftPath, fs);
    const localRelatives = new Set(
      localFiles.map(f => path.relative(draftPath, f).split(path.sep).join('/'))
    );

    const pathsToDelete: string[] = [];

    for (const entry of responses) {
      const href = entry['D:href'];
      if (!href) {continue;}

      const entryUrl = new URL(href, targetUrl);
      const basePath = new URL(targetUrl).pathname;
      const relative = entryUrl.pathname.slice(basePath.length);

      if (!relative || relative === '/') {continue;}

      // Check if it's a draft path
      const draftPrefix = FolderNames.DRAFT + '/';
      if (!relative.startsWith(draftPrefix)) {continue;}

      const draftRelative = relative.slice(draftPrefix.length);
      if (!draftRelative) {continue;}

      // Skip directories (end with /)
      if (draftRelative.endsWith('/')) {continue;}

      // Skip gitignored files
      const localEquivalent = path.join(draftPath, ...draftRelative.split('/'));
      if (gitignoreMatcher.matches(localEquivalent)) {
        logger.info(`File is in .gitignore; skipping deletion: ${href}`);
        continue;
      }

      // If no local equivalent, mark for deletion
      if (!localRelatives.has(draftRelative)) {
        pathsToDelete.push(entryUrl.href);
      }
    }

    if (pathsToDelete.length === 0) {
      logger.info('No unused upstairs paths to delete.');
      return;
    }

    const YES = 'Yes';
    const NO = 'No';
    const answer = await prompt.confirm(
      `The following ${pathsToDelete.length} upstairs path(s) no longer have local counterparts:\n\n${pathsToDelete.join('\n')}\n\nDelete them?`,
      [YES, NO]
    );

    if (answer !== YES) {
      prompt.info('User chose not to delete unused upstairs paths.');
      return;
    }

    for (const url of pathsToDelete) {
      logger.info('Deleting unused upstairs path: ' + url);
      await session.fetch(url, { method: Http.Methods.DELETE });
    }
  } catch (e) {
    logger.warn(`Cleanup failed: ${e instanceof Error ? e.message : e}`);
  }
}
