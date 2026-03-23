import * as vscode from "vscode";
import { PseudoMap } from "../util/PseudoMaps";
import type { Serializable } from "../util/PseudoMaps/Serializable";

/**
 * An abstract base class for elements of the extension that require a vscode context, and some form of persistance.
 */
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
   * the map that this context node manages.
   */
  protected abstract map(): PseudoMap<string, Serializable>;

  /**
   * Initialize the manager with the given context.
   * if already initialized, throws an error.
   *
   * if the manager has dependencies on other managers, it should also pass themselves as `this` to their `init` methods.
   * @param managerOrContext the context manager to use as parent, or the extension context if this is the root
   */
  abstract init(contextOrManager: vscode.ExtensionContext | ContextNode): this;

  /**
   * Child context nodes that should be disposed when this node is disposed.
   */
  protected readonly children: ContextNode[] = [];

  /**
   * clears the persistance of this context node.
   */
  public clearMap() {
    this.map().clear();
  }

  /**
   * Disposes this node's own resources. Override in subclasses that hold
   * resources like timers or event listeners. Default is a no-op.
   */
  protected disposeSelf(): void {
    // no-op by default
  }

  /**
   * Disposes this node and all of its children, depth-first.
   */
  public dispose(): void {
    for (const child of this.children) {
      child.dispose();
    }
    this.disposeSelf();
  }
}