import * as vscode from "vscode";
import { PersistableMap } from "../util/data/PseudoMaps";
import { SavableObject } from "../../../../types";
export abstract class ContextNode {

  /**
   * the parent context node, or null if this is the root
   * of the context tree.
   */
  abstract parent: ContextNode | null;

  /**
   * the vscode extension context; neccessary for instantiating
   * any of the persistable objects
   */
  abstract context: vscode.ExtensionContext;

  /**
   * the persistable map that this context node manages.
   */
  protected abstract persistence(): PersistableMap<SavableObject>;
  
  /**
   * Initialize the manager with the given context.
   * if already initialized, throws an error.
   *
   * if the manager has dependencies on other managers, it should also pass themselves as `this` to their `init` methods.
   * @param managerOrContext the context manager to use as parent, or the extension context if this is the root
   * @param context the extension context
   */
  abstract init(contextOrManager: vscode.ExtensionContext | ContextNode): this;

}