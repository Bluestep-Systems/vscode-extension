import ts from "typescript";
import * as vscode from "vscode";
import { App } from "../../App";
import { FileSystem } from "../fs/FileSystemFactory";
import { ScriptFile } from "./ScriptFile";
import { TerminalElement } from "./TerminalElement";
const fs = FileSystem.getInstance;

export class Compiler {
  private programs: Map<string, ScriptFile[]> = new Map();
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
  constructor() {
  }

  private getDefaultOptions(sf: TerminalElement): ts.CompilerOptions {
    throw new Error("we probably don't want to be using this");
    const LOCAL_CONFIG = Compiler.DEFAULT_TS_CONFIG;
    LOCAL_CONFIG.rootDir = sf.getScriptRoot().getDraftFolder().path();
    return LOCAL_CONFIG;
  }

  //TODO this really needs to be check to confirm that we are using this right and not redundantly
  private async getCompilerOptions(sf: TerminalElement): Promise<ts.CompilerOptions> {
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
      throw new Error(`Error parsing tsconfig.json at ${tsConfigFile.path()}: ${message}`);
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
    return parsedConfig.options;
  }

  public async addFile(sf: ScriptFile) {
    if (!(await sf.isCopacetic())) {
      throw new Error("File is not copacetic, cannot compile.");
    }
    const newTsConfigFile = await sf.getClosestTsConfigFile();
    const existingVals = this.programs.get(newTsConfigFile.path()) || [];
    this.programs.set(newTsConfigFile.path(), [...existingVals, sf]);
  }

  public async compile() {
    this.programs.forEach(async (sfList, tsConfigPath) => {
      if (sfList.length === 0) {
        App.logger.info("No files to compile for tsconfig at:", tsConfigPath);
        return;
      }
      const compilerOptions = await this.getCompilerOptions(ScriptFile.fromPath(tsConfigPath));
      const program = ts.createProgram(sfList.map(sf => sf.uri().fsPath), compilerOptions);
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
    });

  }
}