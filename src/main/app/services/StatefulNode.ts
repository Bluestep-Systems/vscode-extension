import * as vscode from "vscode";
import { PersistableMap } from "../util/data/PseudoMaps";
import { SavableObject } from "../../../../types";
export abstract class StatefulNode {
  abstract parent: StatefulNode | null;
  abstract context: vscode.ExtensionContext;
  abstract persistance: PersistableMap<SavableObject>;
  /**
   * Initialize the manager with the given context.
   * if already initialized, throws an error.
   * 
   * if the manager has dependencies on other managers, it should also call their initDependencies() methods here.
   * @param context the extension context
   */
  abstract init(contextOrManager: vscode.ExtensionContext | StatefulNode): this;
  abstract initChildren(): void;
  abstract save(): void;
}