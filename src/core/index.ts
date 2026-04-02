export { B6PUri } from './B6PUri';
export { B6PCore } from './B6PCore';
export type { AuditResult, ReportResult } from './B6PCore';
export type {
  B6PProviders,
  FileStat,
  IFileSystem,
  ILogger,
  IPersistence,
  IProgress,
  IPrompt,
  ProgressTask,
} from './providers';

// Re-export pure data classes
export { DownstairsPathParser } from './data/DownstairsPathParser';
export { GlobMatcher } from './data/GlobMatcher';
export { IdUtility } from './data/IdUtility';

// Re-export already-clean modules from main (no vscode deps)
export { Err } from '../main/app/util/Err';
export { ScriptKey } from '../main/app/util/data/ScriptKey';

// Core session + auth
export { SessionManager } from './session/SessionManager';
export { BasicAuthProvider } from './auth/BasicAuthProvider';
export { OrgWorker } from './data/OrgWorker';
export { ScriptUrlParser } from './data/ScriptUrlParser';
export { executePush } from './push';
