import * as vscode from 'vscode';
import { App } from '../App';
import ctrlPCommands from '../ctrl-p-commands';

/**
 * Input schema for the pull_script LM tool.
 * @lastreviewed null
 */
interface PullScriptInput {
  webDavUrl: string;
}

/**
 * A VS Code Language Model tool that pulls a BlueStep script by its WebDAV URL.
 *
 * The AI workflow is:
 * 1. Call the BlueStep MCP server's `lookup_script_by_name` tool to find a script
 * 2. Extract the `webDavUrl` from the response
 * 3. Pass it to this tool to pull the script into the local workspace
 *
 * @lastreviewed null
 */
export const PULL_SCRIPT_TOOL: vscode.LanguageModelTool<PullScriptInput> = {

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<PullScriptInput>,
    _token: vscode.CancellationToken,
  ): Promise<vscode.LanguageModelToolResult> {
    const { webDavUrl } = options.input;

    try {
      App.logger.info(`PullScriptTool: Pulling script from ${webDavUrl}`);
      await ctrlPCommands.pullScript(webDavUrl);

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          JSON.stringify({ success: true, webDavUrl }),
        ),
      ]);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      App.logger.error(`PullScriptTool: ${message}`);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          JSON.stringify({ error: message }),
        ),
      ]);
    }
  },

  prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<PullScriptInput>,
    _token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.PreparedToolInvocation> {
    return {
      invocationMessage: `Pulling script from ${options.input.webDavUrl}...`,
    };
  },
};
