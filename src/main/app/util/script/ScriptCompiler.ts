import ts from "typescript";
import * as vscode from "vscode";
import { App } from "../../App";
import { FileSystem } from "../fs/FileSystemFactory";
import { RemoteScriptFile } from "./RemoteScriptFile";
import { RemoteTsConfigFile } from "./RemoteTsConfigFile";
const fs = FileSystem.getInstance;
export class ScriptCompiler {
  private sfList: RemoteScriptFile[];
  private tsConfig: RemoteTsConfigFile;
  private static DEFAULT_TS_CONFIG: ts.CompilerOptions = {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
    outDir: ".build",
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    sourceMap: false,
    inlineSourceMap: false,
    allowJs: false,
    noEmitOnError: false,
    suppressOutputPathCheck: true,
    declarationDir: undefined,
    declaration: false,
  };
  private constructor(sf: RemoteScriptFile, tsConfigFile: RemoteTsConfigFile) {
    this.sfList = [sf];
    this.tsConfig = tsConfigFile;
  }

  /**
   * Creates a new ScriptCompiler instance, verifying that the provided RemoteScriptFile
   * is in a proper state for compilation.
   */
  static async create(sf: RemoteScriptFile) {
    if (!(await sf.isCopacetic())) {
      throw new Error("File is not copacetic, cannot compile.");
    }
    const closestTsConfig = await sf.getClosestTsConfigFile();
    if (!(await closestTsConfig.isCopacetic())) {
      throw new Error("closestTsConfig is not copacetic, cannot compile.");
    }
    return new ScriptCompiler(sf, closestTsConfig);
  }

  private getDefaultOptions(): ts.CompilerOptions {
    const LOCAL_CONFIG = ScriptCompiler.DEFAULT_TS_CONFIG;
    LOCAL_CONFIG.rootDir = this.tsConfig.folder().fsPath();
    return LOCAL_CONFIG;
  }

  //TODO this really needs to be check to confirm that we are using this right and not redundantly
  private async getCompilerOptions(): Promise<ts.CompilerOptions> {
    const tsConfigUri = this.tsConfig.getUri();
    if (!tsConfigUri) {
      App.logger.info("No tsconfig.json found, using default compiler options.");
      return this.getDefaultOptions();
    }
    const tsconfigTextArray = await fs().readFile(tsConfigUri);
    const tsconfig = ts.parseConfigFileTextToJson(tsConfigUri.fsPath, Buffer.from(tsconfigTextArray).toString('utf-8'));
    const X = this.tsConfig.getUri().fsPath;
    tsconfig.config.compilerOptions.rootDir = X;
    // Parse the configuration but ignore file discovery errors
    // We'll handle file discovery ourselves since we're working with specific files
    const parsedConfig = ts.parseJsonConfigFileContent(
      tsconfig.config,
      {
        ...ts.sys,
        // Override readDirectory to return empty array - we don't want TS to validate include/exclude
        readDirectory: () => []
      },
      this.tsConfig.folder().fsPath(),
      undefined,
      tsConfigUri.fsPath
    );
    App.logger.info("Using tsconfig.json compiler options from:", tsConfigUri.fsPath);
    return parsedConfig.options;
  }

  public async addFile(sf: RemoteScriptFile) {
    const newTsConfigFile = await sf.getClosestTsConfigFile();
    if (!this.tsConfig.equals(newTsConfigFile)) {
      throw new Error("All files must share the same tsconfig.json");
    }
    if (!(await sf.isCopacetic())) {
      throw new Error("File is not copacetic, cannot add to list.");
    }
    this.sfList.push(sf);
  }

  public async compile() {
    // Create a TypeScript program
    const program = ts.createProgram(this.sfList.map(sf => sf.getUri().fsPath), await this.getCompilerOptions());
    const emitResult = program.emit();

    // Handle diagnostics
    const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
    if (allDiagnostics.length > 0) {
      const diagnosticMessages = allDiagnostics.map(diagnostic => {
        if (diagnostic.file) {
          const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!);
          const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
          return `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`;
        } else {
          return ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        }
      }).join('\n');
      //TODO these errors need to be handled appropriately by ultimately fixing the B typedoc problems
      App.logger.error("TypeScript compilation errors:\n" + diagnosticMessages);
      //vscode.window.showErrorMessage(`TypeScript compilation errors:\n${diagnosticMessages}`);
    } else {
      vscode.window.showInformationMessage('TypeScript compiled successfully.');
    }
  }
}