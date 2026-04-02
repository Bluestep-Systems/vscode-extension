/**
 * Simple interface for objects that need cleanup on disposal.
 * Replaces the ContextNode disposal hierarchy with explicit cleanup.
 * @lastreviewed null
 */
export interface Disposable {
  /**
   * Dispose of any resources held by this object.
   * Should be idempotent - safe to call multiple times.
   */
  dispose(): void;
}

/**
 * Helper to manage a collection of disposables.
 * @lastreviewed null
 */
export class DisposableRegistry implements Disposable {
  private disposables: Disposable[] = [];

  /**
   * Register a disposable for cleanup.
   */
  add(...items: Disposable[]): void {
    this.disposables.push(...items);
  }

  /**
   * Dispose all registered items in reverse order (LIFO).
   */
  dispose(): void {
    for (let i = this.disposables.length - 1; i >= 0; i--) {
      try {
        this.disposables[i].dispose();
      } catch (error) {
        console.error('Error disposing item:', error);
      }
    }
    this.disposables = [];
  }
}
