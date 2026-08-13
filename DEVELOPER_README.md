## IMPORTANT

install the required vscode extensions found in the .vscode/extensions.json file before starting to develop.

---

# 🧪 **Testing System Configuration & Architecture**

## **📋 Overview**

The testing system uses **VS Code's official testing framework** with **Mocha** as the test runner, specifically designed for VS Code extension development. Here's how it all works:

---

## **🔧 Core Configuration Files**

### **1. Package.json - Test Scripts & Dependencies**
```json
{
  "scripts": {
    "compile-tests": "tsc -p . --outDir out",
    "watch-tests": "tsc -p . -w --outDir out", 
    "pretest": "npm run compile-tests && npm run compile",
    "test": "vscode-test"
  },
  "devDependencies": {
    "@vscode/test-cli": "^0.0.11",        // VS Code test runner CLI
    "@vscode/test-electron": "^2.5.2",    // Electron-based VS Code test environment
    "@types/mocha": "^10.0.10"            // TypeScript types for Mocha
  }
}
```

### **2. .vscode-test.mjs - Test Runner Configuration**
```javascript
import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out/test/**/*.test.js',  // Points to compiled test files
});
```

### **3. tsconfig.json - TypeScript Compilation**
- **Compiles tests** from `src/test/**/*` to `out/test/**/*.js`
- **Includes test files** in the compilation process
- **Strict TypeScript** settings ensure type safety

---

## **🏗️ Test Execution Flow**

### **When you run `npm test`:**

1. **Pre-test steps** (`pretest` script):
   ```bash
   npm run compile-tests  # Compile TypeScript tests → out/
   npm run compile        # Compile main code → dist/
   ```
   (There is no lint step — ESLint was removed with the TypeScript 7 upgrade, since
   `@typescript-eslint` supports `typescript <6.1.0`. `npm run format-check` is the
   style gate, and CI runs it.)

2. **Test execution** (`test` script):
   ```bash
   vscode-test          # Uses .vscode-test.mjs config
   ```

3. **VS Code Test Runner**:
   - Downloads/uses VS Code Electron instance
   - Loads extension in test environment
   - Runs compiled tests from `out/test/**/*.test.js`
   - Uses Mocha framework for test execution

---

## **📁 Test File Structure**

```
src/test/
├── extension.test.ts          # Basic extension tests
└── ScriptFile.test.ts   # Comprehensive unit tests (22 tests)

out/test/                      # Compiled test files (generated)
├── extension.test.js
└── ScriptFile.test.js
```

---

## **🎯 Test Types & Architecture**

### **1. VS Code Extension Tests** (`extension.test.ts`)
- **Simple integration test**
- **Tests basic extension loading**
- **Sample test for framework verification**

### **2. Unit Tests** (`ScriptFile.test.ts`)
- **22 comprehensive tests**
- **Mock file system** using our custom `FileSystemFactory`
- **Tests core business logic** without VS Code API dependencies

---

## **🔄 File System Abstraction for Testing**

### **The Problem We Solved:**
VS Code file system APIs are **read-only** and can't be mocked directly.

### **Our Solution:**
```typescript
// FileSystemFactory namespace provides dependency injection
FileSystemFactory.enableTestMode()    // Switch to mock provider
FileSystemFactory.enableProductionMode()  // Switch to real VS Code APIs

// In tests:
mockFileSystemProvider.setMockFile(uri, content)
mockFileSystemProvider.setMockError(uri, error)
```

### **Benefits:**
- ✅ **Proper unit testing** without file system dependencies
- ✅ **Predictable test data** 
- ✅ **Error simulation** capabilities
- ✅ **Fast test execution** (no actual file I/O)

---

## **🚀 Development Workflow**

### **Running Tests:**
```bash
npm test                    # Full test suite with compilation
npm run watch-tests         # Watch mode for test development
```

### **VS Code Integration:**
- **Tasks**: `.vscode/tasks.json` defines build and watch tasks
- **Launch**: `.vscode/launch.json` for debugging the extension
- **Problems Panel**: Shows test failures and compilation errors

### **Build Integration:**
Our `build-vsix.sh` script now includes:
```bash
🧪 Running tests to ensure code quality...
✅ All tests passed!      # Only proceeds if tests pass
❌ Tests failed! Build aborted.  # Stops build on failure
```

---

## **⚡ Key Features**

### **1. Fast Feedback Loop**
- **Watch mode** recompiles tests on file changes
- **Parallel compilation** for main code and tests
- **Lint integration** catches issues early

### **2. Quality Gates**
- **Pre-test compilation** ensures type safety
- **Lint checks** enforce code style
- **Build integration** prevents broken releases

### **3. VS Code Specific**
- **Extension Host testing** - tests run in actual VS Code environment
- **VS Code API access** - can test extension interactions
- **Electron environment** - matches production runtime

### **4. Comprehensive Coverage**
- **22 test cases** covering file operations, URI parsing, hash calculation
- **Error scenarios** tested via mock file system
- **Edge cases** like metadata files, different file types

---

## **🎪 Test Categories (ScriptFile.test.ts)**

1. **File Type Detection** - Draft, declarations, metadata files
2. **URI Operations** - Path conversions and validations  
3. **Hash Calculation** - SHA-512 hashing with error handling
4. **File Existence Checks** - File vs directory detection
5. **Content Operations** - Reading/writing with error scenarios
6. **Equality Comparison** - Object comparison logic
7. **ScriptRoot Operations** - Root object management
8. **Time Operations** - File modification time handling

This testing architecture provides a **robust foundation** for maintaining code quality while enabling **rapid development** of the VS Code extension! 🎉

