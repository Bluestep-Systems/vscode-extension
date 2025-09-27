import ts from "typescript";
import * as vscode from "vscode";
import { App } from "../../App";
import { Err } from "../Err";
import { FileSystem } from "../fs/FileSystem";
import { ScriptFactory } from "./ScriptFactory";
import type { ScriptNode } from "./ScriptNode";
const fs = FileSystem.getInstance;

/**
 * Compiler for TypeScript files in script projects.
 * Manages compilation of multiple TypeScript files organized by their tsconfig.json files.
 * @lastreviewed null
 */
export class ScriptCompiler {
  private projects: Map<string, ScriptNode[]> = new Map();
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
    listEmittedFiles: true,
  };

  /**
   * Creates a new ScriptCompiler instance.
   * @lastreviewed null
   */
  constructor() { }

  /**
   * Gets default TypeScript compiler options for a file.
   * @param sf The file to get default options for
   * @returns Default TypeScript compiler options
   * @throws {Error} Always throws as this method is deprecated
   * @lastreviewed null
   */
  private getDefaultOptions(sf: ScriptNode): ts.CompilerOptions {
    throw new Err.MethodNotImplementedError();
    const LOCAL_CONFIG = ScriptCompiler.DEFAULT_TS_CONFIG;
    LOCAL_CONFIG.rootDir = sf.getScriptRoot().getDraftFolder().path();
    return LOCAL_CONFIG;
  }

  /**
   * Gets TypeScript compiler options from the closest tsconfig.json file.
   * @param sf The file to get compiler options for
   * @returns A Promise that resolves to TypeScript compiler options
   * @throws {Error} When tsconfig.json parsing fails
   * @lastreviewed null
   */
  private async getCompilerOptions(sf: ScriptNode): Promise<ts.CompilerOptions> {
    const tsConfigFile = await sf.getClosestTsConfigFile();
    if (!tsConfigFile) {
      App.logger.info("No tsconfig.json found, using default compiler options.");
      return this.getDefaultOptions(sf);
    }

    const tsconfigTextArray = await fs().readFile(tsConfigFile.uri());
    const pseudoParsedConfig = ts.parseConfigFileTextToJson(tsConfigFile.path(), Buffer.from(tsconfigTextArray).toString('utf-8'));
    pseudoParsedConfig.config.compilerOptions.rootDir = tsConfigFile.folder().path();
    if (pseudoParsedConfig.error) {
      const message = ts.flattenDiagnosticMessageText(pseudoParsedConfig.error.messageText, '\n');
      throw new Err.CompilationError(`Error parsing tsconfig.json at ${tsConfigFile.path()}: ${message}`);
    }
    // Parse the configuration but ignore file discovery errors
    // We'll handle file discovery ourselves since we're working with specific files
    const parsedConfig = ts.parseJsonConfigFileContent(
      pseudoParsedConfig.config,
      {
        ...ts.sys,
        // Override readDirectory to return empty array - we don't want TS to validate include/exclude
        readDirectory: () => []
      },
      tsConfigFile.folder().path(),
      undefined,
      tsConfigFile.path()
    );
    App.logger.info("Using tsconfig.json compiler options from:", tsConfigFile.path);
    // Ensure listEmittedFiles is always enabled so we can track emitted files
    parsedConfig.options.listEmittedFiles = true;
    // Ensure output files are overwritten if they already exist
    return parsedConfig.options;
  }

  /**
   * Adds a script file to the compilation queue.
   * Files are grouped by their associated tsconfig.json file.
   * @param sf The ScriptFile to add for compilation
   * @throws {Error} When the file is not copacetic and cannot be compiled
   * @lastreviewed null
   */
  public async addFile(sf: ScriptNode) {
    if (!(await sf.isCopacetic())) {
      throw new Err.ScriptNotCopaceticError();
    }
    const newTsConfigFile = await sf.getClosestTsConfigFile();
    const existingVals = this.projects.get(newTsConfigFile.path()) || [];
    this.projects.set(newTsConfigFile.path(), [...existingVals, sf]);
  }

  /**
   * Compiles all added TypeScript files grouped by their tsconfig.json configurations.
   * Shows compilation results and diagnostics to the user.
   * @lastreviewed null
   */
  public async compile() {
    const emittedFiles: string[] = [];
    for (const [tsConfigPath, sfList] of this.projects.entries()) {
      if (sfList.length === 0) {
        throw new Err.NoFilesToCompileError(tsConfigPath);
      }
      const compilerOptions = await this.getCompilerOptions(ScriptFactory.createFile(vscode.Uri.file(tsConfigPath)));
      const sfUris = sfList.map(sf => sf.uri());
      const program = ts.createProgram(sfUris.map(uri => uri.fsPath), compilerOptions);
      const emitResult = program.emit();
      emittedFiles.push(...(emitResult.emittedFiles || []));

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
    };
    return emittedFiles;
  }
}