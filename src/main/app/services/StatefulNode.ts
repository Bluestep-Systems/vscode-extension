import * as vscode from "vscode";
import { PersistableMap } from "../util/data/PseudoMaps";
import { SavableObject } from "../../../../types";
export abstract class StatefulNode {
  abstract parent: StatefulNode | null;
  abstract context: vscode.ExtensionContext;
  protected abstract persistance: PersistableMap<SavableObject>;
  /**
   * Initialize the manager with the given context.
   * if already initialized, throws an error.
   * 
   * if the manager has dependencies on other managers, it should also call their initChildren() method here.
   * @param context the extension context
   */
  abstract init(contextOrManager: vscode.ExtensionContext | StatefulNode): this;

  /**
   * Initialize any child managers that depend on this manager being initialized first.
   * if the manager has no children, this can be a no-op.
   */
  abstract initChildren(): void;
  
}