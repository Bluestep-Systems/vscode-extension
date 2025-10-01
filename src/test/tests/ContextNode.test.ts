//@ts-ignore
import * as assert from 'assert';
//@ts-ignore
import * as vscode from 'vscode';
//@ts-ignore
import { ContextNode } from '../../main/app/context/ContextNode';
//@ts-ignore
import { PseudoMap } from '../../main/app/util/PseudoMaps';
//@ts-ignore
import { Serializable } from '../../../types';
//@ts-ignore
import { FileSystem } from '../../main/app/util/fs/FileSystem';
//@ts-ignore
import { MockFileSystem } from '../../main/app/util/fs/FileSystemProvider';

// suite('ContextNode Pattern Tests', () => {
//   let mockFileSystemProvider: MockFileSystem;
//   let mockContext: vscode.ExtensionContext;

//   // Test implementation of ContextNode for testing purposes
//   class TestContextNode extends ContextNode {
//     public parent: ContextNode | null = null;
//     public context: vscode.ExtensionContext;
//     private _map: PseudoMap<string, Serializable> | null = null;
//     private _initialized = false;

//     constructor(context?: vscode.ExtensionContext) {
//       super();
//       this.context = context || mockContext;
//     }

//     protected map(): PseudoMap<string, Serializable> {
//       if (!this._map) {
//         throw new Error('Map not initialized');
//       }
//       return this._map;
//     }

//     init(contextOrManager: vscode.ExtensionContext | ContextNode): this {
//       if (this._initialized) {
//         throw new Error('Already initialized');
//       }

//       if (contextOrManager instanceof ContextNode) {
//         this.parent = contextOrManager;
//         this.context = contextOrManager.context;
//       } else {
//         this.context = contextOrManager;
//       }

//       // Mock map implementation for testing
//       this._map = new MockPseudoMap();
//       this._initialized = true;
//       return this;
//     }

//     isInitialized(): boolean {
//       return this._initialized;
//     }
//   }

//   // Mock PseudoMap implementation for testing
//   class MockPseudoMap extends PseudoMap<string, Serializable> {
//     private storage = new Map<string, Serializable>();

//     constructor() {
//       super();
//     }

//     get(key: string): Serializable {
//       return this.storage.get(key) as Serializable;
//     }

//     set(key: string, value: Serializable): void {
//       this.storage.set(key, value);
//     }

//     has(key: string): boolean {
//       return this.storage.has(key);
//     }

//     delete(key: string): boolean {
//       return this.storage.delete(key);
//     }

//     clear(): void {
//       this.storage.clear();
//     }

//     keys(): IterableIterator<string> {
//       return this.storage.keys();
//     }

//     values(): IterableIterator<Serializable> {
//       return this.storage.values();
//     }

//     entries(): IterableIterator<[string, Serializable]> {
//       return this.storage.entries();
//     }

//     forEach(callback: (value: Serializable, key: string, map: this) => void): void {
//       this.storage.forEach((value, key) => callback(value, key, this));
//     }

//     get size(): number {
//       return this.storage.size;
//     }

//     [Symbol.iterator](): IterableIterator<[string, Serializable]> {
//       return this.storage[Symbol.iterator]();
//     }
//   }

//   suiteSetup(() => {
//     // Enable test mode with mock file system
//     mockFileSystemProvider = FileSystem.enableTestMode();
//   });

//   suiteTeardown(() => {
//     // Restore production mode
//     FileSystem.enableProductionMode();
//   });

//   setup(() => {
//     // Clear any previous mock data
//     mockFileSystemProvider.clearMocks();

//     // Create a comprehensive mock ExtensionContext
//     mockContext = {
//       subscriptions: [],
//       workspaceState: {
//         get: () => undefined,
//         update: async () => undefined,
//         keys: () => []
//       },
//       globalState: {
//         get: () => undefined,
//         update: async () => undefined,
//         setKeysForSync: () => undefined,
//         keys: () => []
//       },
//       secrets: {
//         get: async () => undefined,
//         store: async () => undefined,
//         delete: async () => undefined,
//         onDidChange: new vscode.EventEmitter().event
//       },
//       extensionUri: vscode.Uri.file('/test/extension'),
//       extensionPath: '/test/extension',
//       environmentVariableCollection: {} as any,
//       asAbsolutePath: (relativePath: string) => `/test/extension/${relativePath}`,
//       storageUri: vscode.Uri.file('/test/storage'),
//       globalStorageUri: vscode.Uri.file('/test/globalStorage'),
//       logUri: vscode.Uri.file('/test/logs'),
//       extensionMode: vscode.ExtensionMode.Test,
//       extension: {
//         id: 'test-extension',
//         extensionUri: vscode.Uri.file('/test/extension'),
//         extensionPath: '/test/extension',
//         isActive: true,
//         packageJSON: { version: '1.0.0-test' },
//         extensionKind: vscode.ExtensionKind.Workspace,
//         exports: undefined,
//         activate: async () => undefined
//       }
//     } as unknown as vscode.ExtensionContext;
//   });

//   suite('Basic ContextNode Functionality', () => {
//     test('should create ContextNode with proper abstract structure', () => {
//       const node = new TestContextNode();

//       assert.ok(node instanceof ContextNode, 'Should be instance of ContextNode');
//       assert.strictEqual(typeof node.init, 'function', 'Should have init method');
//       assert.strictEqual(typeof node.clearMap, 'function', 'Should have clearMap method');
//       assert.strictEqual(node.parent, null, 'Parent should initially be null');
//     });

//     test('should initialize with ExtensionContext', () => {
//       const node = new TestContextNode();
//       const initializedNode = node.init(mockContext);

//       assert.strictEqual(initializedNode, node, 'init should return the same instance');
//       assert.strictEqual(node.context, mockContext, 'Context should be set');
//       assert.strictEqual(node.parent, null, 'Parent should be null when initialized with context');
//       assert.strictEqual(node.isInitialized(), true, 'Should be marked as initialized');
//     });

//     test('should initialize with parent ContextNode', () => {
//       const parentNode = new TestContextNode();
//       parentNode.init(mockContext);

//       const childNode = new TestContextNode();
//       childNode.init(parentNode);

//       assert.strictEqual(childNode.parent, parentNode, 'Parent should be set');
//       assert.strictEqual(childNode.context, mockContext, 'Context should be inherited from parent');
//       assert.strictEqual(childNode.isInitialized(), true, 'Child should be initialized');
//     });

//     test('should throw error on double initialization', () => {
//       const node = new TestContextNode();
//       node.init(mockContext);

//       assert.throws(() => {
//         node.init(mockContext);
//       }, /Already initialized/, 'Should throw error on double initialization');
//     });

//     test('should throw error when accessing map before initialization', () => {
//       const node = new TestContextNode();

//       assert.throws(() => {
//         node.clearMap();
//       }, /Map not initialized/, 'Should throw error when accessing uninitialized map');
//     });
//   });

//   suite('Hierarchical Context Management', () => {
//     test('should create multi-level hierarchy', () => {
//       const rootNode = new TestContextNode();
//       rootNode.init(mockContext);

//       const middleNode = new TestContextNode();
//       middleNode.init(rootNode);

//       const leafNode = new TestContextNode();
//       leafNode.init(middleNode);

//       assert.strictEqual(rootNode.parent, null, 'Root should have no parent');
//       assert.strictEqual(middleNode.parent, rootNode, 'Middle should have root as parent');
//       assert.strictEqual(leafNode.parent, middleNode, 'Leaf should have middle as parent');

//       // All should share the same context
//       assert.strictEqual(rootNode.context, mockContext, 'Root should have original context');
//       assert.strictEqual(middleNode.context, mockContext, 'Middle should inherit context');
//       assert.strictEqual(leafNode.context, mockContext, 'Leaf should inherit context');
//     });

//     test('should propagate context changes through hierarchy', () => {
//       const parentNode = new TestContextNode();
//       parentNode.init(mockContext);

//       const childNode = new TestContextNode();
//       childNode.init(parentNode);

//       // Create new context and update parent
//       const newContext = { ...mockContext, extensionPath: '/new/path' } as vscode.ExtensionContext;
//       parentNode.context = newContext;

//       // Child should inherit the new context
//       childNode.init(parentNode); // Re-init to pick up new context
//       assert.strictEqual(childNode.context, newContext, 'Child should inherit updated context');
//     });

//     test('should maintain independent state per node', () => {
//       const node1 = new TestContextNode();
//       node1.init(mockContext);

//       const node2 = new TestContextNode();
//       node2.init(mockContext);

//       // Nodes should be independent even with same context
//       assert.notStrictEqual(node1, node2, 'Nodes should be different instances');
//       assert.strictEqual(node1.context, node2.context, 'But should share same context');
//     });
//   });

//   suite('Map Operations and Persistence', () => {
//     test('should support basic map operations after initialization', () => {
//       const node = new TestContextNode();
//       node.init(mockContext);

//       // Access the map through the protected method via clearMap
//       // Since we can't directly access the protected map() method, we test through clearMap
//       node.clearMap(); // Should not throw
//       assert.ok(true, 'clearMap should work after initialization');
//     });

//     test('should clear map contents', () => {
//       const node = new TestContextNode();
//       node.init(mockContext);

//       // Set some data in the map
//       const map = (node as any).map();
//       map.set('test-key', 'test-value');
//       assert.strictEqual(map.get('test-key'), 'test-value', 'Value should be set');

//       // Clear the map
//       node.clearMap();

//       // Verify the map is cleared
//       assert.strictEqual(map.get('test-key'), undefined, 'Value should be cleared');
//       assert.strictEqual(map.size, 0, 'Map should be empty');
//     });

//     test('should handle map operations with different data types', () => {
//       const node = new TestContextNode();
//       node.init(mockContext);

//       const map = (node as any).map();

//       // Test different serializable types
//       const testData = {
//         string: 'test string',
//         number: 42,
//         boolean: true,
//         object: { nested: 'value' },
//         array: [1, 2, 3],
//         null: null
//       };

//       // Set all test data
//       Object.entries(testData).forEach(([key, value]) => {
//         map.set(key, value);
//       });

//       // Verify all data was set correctly
//       Object.entries(testData).forEach(([key, value]) => {
//         assert.deepStrictEqual(map.get(key), value, `Value for ${key} should match`);
//       });

//       // Verify map size
//       assert.strictEqual(map.size, Object.keys(testData).length, 'Map size should match');
//     });

//     test('should support iteration over map contents', () => {
//       const node = new TestContextNode();
//       node.init(mockContext);

//       const map = (node as any).map();

//       const testEntries = [
//         ['key1', 'value1'],
//         ['key2', 42],
//         ['key3', { complex: 'object' }]
//       ];

//       // Add test entries
//       testEntries.forEach(([key, value]) => {
//         map.set(key, value);
//       });

//       // Test forEach iteration
//       const iteratedEntries: [string, Serializable][] = [];
//       map.forEach((value: Serializable, key: string) => {
//         iteratedEntries.push([key, value]);
//       });

//       assert.strictEqual(iteratedEntries.length, testEntries.length, 'Should iterate over all entries');

//       // Verify all entries were iterated
//       testEntries.forEach(([key, value]) => {
//         const found = iteratedEntries.find(([k, v]) => k === key && JSON.stringify(v) === JSON.stringify(value));
//         assert.ok(found, `Entry ${key}: ${JSON.stringify(value)} should be found in iteration`);
//       });
//     });
//   });

//   suite('Error Handling and Edge Cases', () => {
//     test('should handle initialization with null parent gracefully', () => {
//       const node = new TestContextNode();

//       // This should not throw - the abstract class allows null parent
//       node.parent = null;
//       node.init(mockContext);

//       assert.strictEqual(node.parent, null, 'Parent should remain null');
//       assert.strictEqual(node.context, mockContext, 'Context should be set');
//     });

//     test('should handle context inheritance chain interruption', () => {
//       const parentNode = new TestContextNode();
//       parentNode.init(mockContext);

//       const childNode = new TestContextNode();
//       childNode.init(parentNode);

//       // Simulate context becoming unavailable in parent
//       delete (parentNode as any).context;

//       // Child should still maintain its reference to the context
//       assert.strictEqual(childNode.context, mockContext, 'Child should maintain context reference');
//     });

//     test('should maintain consistency during concurrent operations', async () => {
//       const node = new TestContextNode();
//       node.init(mockContext);

//       const map = (node as any).map();

//       // Simulate concurrent operations
//       const operations = [];
//       for (let i = 0; i < 10; i++) {
//         operations.push(
//           Promise.resolve().then(() => {
//             map.set(`key${i}`, `value${i}`);
//           })
//         );
//       }

//       await Promise.all(operations);

//       // Verify all operations completed successfully
//       for (let i = 0; i < 10; i++) {
//         assert.strictEqual(map.get(`key${i}`), `value${i}`, `Concurrent operation ${i} should succeed`);
//       }

//       assert.strictEqual(map.size, 10, 'All concurrent operations should be reflected');
//     });

//     test('should handle large data volumes', () => {
//       const node = new TestContextNode();
//       node.init(mockContext);

//       const map = (node as any).map();

//       // Add a large number of entries
//       const entryCount = 1000;
//       for (let i = 0; i < entryCount; i++) {
//         map.set(`key${i}`, {
//           index: i,
//           data: `data${i}`.repeat(10), // Make entries larger
//           timestamp: Date.now()
//         });
//       }

//       assert.strictEqual(map.size, entryCount, 'Should handle large number of entries');

//       // Verify some random entries
//       const testIndices = [0, 100, 500, 999];
//       testIndices.forEach(index => {
//         const value = map.get(`key${index}`) as any;
//         assert.strictEqual(value.index, index, `Entry at index ${index} should be correct`);
//       });

//       // Clear and verify
//       node.clearMap();
//       assert.strictEqual(map.size, 0, 'Large map should clear successfully');
//     });

//     test('should handle rapid initialization and destruction cycles', () => {
//       // Test multiple rapid init/destroy cycles
//       for (let cycle = 0; cycle < 5; cycle++) {
//         const node = new TestContextNode();
//         node.init(mockContext);

//         const map = (node as any).map();
//         map.set('test', `cycle${cycle}`);

//         assert.strictEqual(map.get('test'), `cycle${cycle}`, `Cycle ${cycle} should work`);

//         node.clearMap();
//         assert.strictEqual(map.size, 0, `Cycle ${cycle} should clear`);
//       }
//     });
//   });

//   suite('Parent-Child Relationship Management', () => {
//     test('should maintain proper parent references', () => {
//       const grandparent = new TestContextNode();
//       grandparent.init(mockContext);

//       const parent = new TestContextNode();
//       parent.init(grandparent);

//       const child = new TestContextNode();
//       child.init(parent);

//       // Verify the hierarchy
//       assert.strictEqual(child.parent, parent, 'Child should reference parent');
//       assert.strictEqual(parent.parent, grandparent, 'Parent should reference grandparent');
//       assert.strictEqual(grandparent.parent, null, 'Grandparent should have no parent');
//     });

//     test('should handle parent relationship changes', () => {
//       const originalParent = new TestContextNode();
//       originalParent.init(mockContext);

//       const newParent = new TestContextNode();
//       newParent.init(mockContext);

//       const child = new TestContextNode();
//       child.init(originalParent);

//       assert.strictEqual(child.parent, originalParent, 'Should initially reference original parent');

//       // Change parent (simulate re-initialization)
//       child.init(newParent);
//       assert.strictEqual(child.parent, newParent, 'Should reference new parent after re-init');
//     });

//     test('should handle orphaned nodes', () => {
//       const parent = new TestContextNode();
//       parent.init(mockContext);

//       const child = new TestContextNode();
//       child.init(parent);

//       // Simulate parent becoming unavailable
//       child.parent = null;

//       // Child should still function with its context
//       assert.strictEqual(child.context, mockContext, 'Orphaned child should retain context');
//       assert.strictEqual(child.parent, null, 'Orphaned child should have null parent');
//     });
//   });

//   suite('Memory Management and Cleanup', () => {
//     test('should properly clean up map resources', () => {
//       const node = new TestContextNode();
//       node.init(mockContext);

//       const map = (node as any).map();

//       // Add data that might create references
//       const circularRef: any = { self: null };
//       circularRef.self = circularRef;

//       map.set('circular', circularRef);
//       map.set('large-array', new Array(1000).fill('data'));

//       // Clear should remove all references
//       node.clearMap();
//       assert.strictEqual(map.size, 0, 'All references should be cleared');
//     });

//     test('should handle disposal of resources', () => {
//       const nodes: TestContextNode[] = [];

//       // Create multiple nodes
//       for (let i = 0; i < 10; i++) {
//         const node = new TestContextNode();
//         node.init(mockContext);
//         nodes.push(node);
//       }

//       // Clear all nodes
//       nodes.forEach(node => {
//         node.clearMap();
//       });

//       // Verify all are cleared
//       nodes.forEach((node, index) => {
//         const map = (node as any).map();
//         assert.strictEqual(map.size, 0, `Node ${index} should be cleared`);
//       });
//     });
//   });
// });