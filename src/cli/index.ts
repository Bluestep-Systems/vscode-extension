import { Command } from 'commander';
import * as path from 'path';
import { B6PCore } from '../core/B6PCore';
import { NodeFileSystem } from './providers/NodeFileSystem';
import { DotfilePersistence } from './providers/DotfilePersistence';
import { CliPrompt } from './providers/CliPrompt';
import { CliLogger } from './providers/CliLogger';
import { CliProgress } from './providers/CliProgress';

function resolve(p: string): string {
  return path.resolve(process.cwd(), p);
}

function createCore(globalOpts: { yes?: boolean; json?: boolean; verbose?: boolean; quiet?: boolean }): {
  core: B6PCore;
  prompt: CliPrompt;
} {
  const prompt = new CliPrompt({ autoYes: globalOpts.yes, json: globalOpts.json });
  const core = new B6PCore({
    fs: new NodeFileSystem(),
    persistence: new DotfilePersistence(process.cwd()),
    prompt,
    logger: new CliLogger({ verbose: globalOpts.verbose }),
    progress: new CliProgress({ quiet: globalOpts.quiet || globalOpts.json }),
  });
  return { core, prompt };
}

const program = new Command('b6p')
  .description('BlueStep B6P script management CLI')
  .version('0.0.1')
  .option('--yes', 'Skip confirmation prompts')
  .option('--json', 'Machine-readable JSON output')
  .option('--verbose', 'Verbose logging')
  .option('--quiet', 'Suppress progress output');

// ── Push ──────────────────────────────────────────────────────────

program
  .command('push [target-url]')
  .description('Push a script to a WebDAV target')
  .option('--file <path>', 'Derive target from local file metadata')
  .option('--root <path>', 'Script root folder')
  .option('--snapshot', 'Push as snapshot')
  .action(async (targetUrl: string | undefined, opts: { file?: string; root?: string; snapshot?: boolean }) => {
    const globalOpts = program.opts();
    const { core, prompt } = createCore(globalOpts);
    try {
      if (opts.file) {
        await core.pushCurrent({ filePath: resolve(opts.file), snapshot: opts.snapshot });
      } else {
        await core.push({
          targetUrl,
          rootPath: resolve(opts.root || '.'),
          snapshot: opts.snapshot,
        });
      }
    } finally {
      prompt.close();
    }
  });

// ── Pull ──────────────────────────────────────────────────────────

program
  .command('pull [formula-url]')
  .description('Pull a script from a WebDAV location')
  .option('--file <path>', 'Derive source from local file metadata')
  .option('--workspace <path>', 'Target workspace folder (default: cwd)')
  .action(async (formulaUrl: string | undefined, opts: { file?: string; workspace?: string }) => {
    const globalOpts = program.opts();
    const { core, prompt } = createCore(globalOpts);
    try {
      if (opts.file) {
        await core.pullCurrent({
          filePath: resolve(opts.file),
          workspacePath: resolve(opts.workspace || '.'),
        });
      } else {
        await core.pull({
          formulaUrl,
          workspacePath: resolve(opts.workspace || '.'),
        });
      }
    } finally {
      prompt.close();
    }
  });

// ── Audit ─────────────────────────────────────────────────────────

program
  .command('audit')
  .description('Compare local script against server state')
  .requiredOption('--file <path>', 'File within the script to audit')
  .option('--pull', 'Pull if differences are detected')
  .option('--workspace <path>', 'Workspace folder (default: cwd)')
  .action(async (opts: { file: string; pull?: boolean; workspace?: string }) => {
    const globalOpts = program.opts();
    const { core, prompt } = createCore(globalOpts);
    try {
      const workspacePath = resolve(opts.workspace || '.');
      if (opts.pull) {
        await core.auditPull({ filePath: resolve(opts.file), workspacePath });
      } else {
        const result = await core.audit({ filePath: resolve(opts.file), workspacePath });
        if (globalOpts.json) {
          process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        }
      }
    } finally {
      prompt.close();
    }
  });

// ── Deploy ────────────────────────────────────────────────────────

program
  .command('deploy <config-file>')
  .description('Quick deploy from a config file to multiple targets')
  .action(async (configFile: string) => {
    const globalOpts = program.opts();
    const { core, prompt } = createCore(globalOpts);
    try {
      await core.deploy({ configPath: resolve(configFile) });
    } finally {
      prompt.close();
    }
  });

// ── Auth ──────────────────────────────────────────────────────────

const auth = program
  .command('auth')
  .description('Manage credentials');

auth
  .command('set')
  .description('Set or update credentials')
  .action(async () => {
    const globalOpts = program.opts();
    const { core, prompt } = createCore(globalOpts);
    try {
      await core.updateCredentials();
    } finally {
      prompt.close();
    }
  });

auth
  .command('clear')
  .description('Clear stored credentials')
  .action(async () => {
    const globalOpts = program.opts();
    const { core, prompt } = createCore(globalOpts);
    try {
      await core.clearSessions();
    } finally {
      prompt.close();
    }
  });

// ── Sessions ──────────────────────────────────────────────────────

program
  .command('sessions')
  .description('Manage sessions')
  .command('clear')
  .description('Clear all active sessions')
  .action(async () => {
    const globalOpts = program.opts();
    const { core, prompt } = createCore(globalOpts);
    try {
      await core.clearSessions();
    } finally {
      prompt.close();
    }
  });

// ── Config ────────────────────────────────────────────────────────

const config = program
  .command('config')
  .description('Manage configuration');

config
  .command('set <key> <value>')
  .description('Set a configuration value')
  .action(async (key: string, value: string) => {
    const globalOpts = program.opts();
    const { core, prompt } = createCore(globalOpts);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        parsed = value;
      }
      await core.setConfig(key, parsed);
    } finally {
      prompt.close();
    }
  });

config
  .command('reset')
  .description('Reset all settings to defaults')
  .action(async () => {
    const globalOpts = program.opts();
    const { core, prompt } = createCore(globalOpts);
    try {
      await core.clearSettings();
    } finally {
      prompt.close();
    }
  });

// ── Report ────────────────────────────────────────────────────────

program
  .command('report')
  .description('Report current state')
  .action(async () => {
    const globalOpts = program.opts();
    const { core, prompt } = createCore(globalOpts);
    try {
      const result = await core.report();
      if (globalOpts.json) {
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      }
    } finally {
      prompt.close();
    }
  });

// ── Check Updates ─────────────────────────────────────────────────

program
  .command('check-updates')
  .description('Check for extension updates')
  .action(async () => {
    const globalOpts = program.opts();
    const { core, prompt } = createCore(globalOpts);
    try {
      await core.checkForUpdates();
    } finally {
      prompt.close();
    }
  });

// ── Setup ─────────────────────────────────────────────────────────

program
  .command('setup')
  .description('Print the setup URL for a script')
  .requiredOption('--file <path>', 'File within the script')
  .action(async (opts: { file: string }) => {
    const globalOpts = program.opts();
    const { core, prompt } = createCore(globalOpts);
    try {
      const url = await core.getSetupUrl({ filePath: resolve(opts.file) });
      if (url) {
        if (globalOpts.json) {
          process.stdout.write(JSON.stringify({ setupUrl: url }, null, 2) + '\n');
        } else {
          prompt.info(`Setup URL: ${url}`);
        }
      }
    } finally {
      prompt.close();
    }
  });

program.parseAsync(process.argv).catch((err: Error) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
