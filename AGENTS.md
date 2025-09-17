# AI Agent Guidelines

## Overview

When making changes to this VS Code extension codebase, AI agents MUST update relevant documentation to maintain consistency and accuracy. This ensures the project remains maintainable and new contributors can quickly understand the system.

## Required Documentation Updates

### 1. Code Changes Requiring Documentation Updates

**When you modify any of these components, update the corresponding documentation:**

- **Architecture changes** → Update `.github/copilot-instructions.md` Architecture Overview section
- **New commands** → Update `package.json` contributes AND `README.md` features section
- **Authentication/Session logic** → Update `.github/copilot-instructions.md` Authentication & Sessions section
- **Build/deployment scripts** → Update `.github/copilot-instructions.md` Development Workflows section
- **New dependencies** → Update `.github/copilot-instructions.md` External Dependencies section
- **Configuration settings** → Update `README.md` Configuration section
- **Update checking logic** → Update `README.md` Custom Update Checking section

### 2. Documentation Files to Maintain

| File | Purpose | Update When |
|------|---------|-------------|
| `.github/copilot-instructions.md` | AI agent development guide | Architecture, patterns, or workflow changes |
| `README.md` | User-facing documentation | Features, configuration, or usage changes |
| `CHANGELOG.md` | Version history | Any user-visible changes or fixes |
| `package.json` | Extension manifest | Commands, settings, dependencies, or metadata |

### 3. Specific Update Requirements

#### For Architecture Changes
- Update the "Core Components" section with new singletons or managers
- Document new patterns in "Key Patterns" section
- Add integration points to "Integration Points" section

#### For New Commands
1. Add to `package.json` → `contributes.commands`
2. Register in `App.ts` → `disposables` map
3. Create command script in `src/main/app/ctrl-p-commands/scripts/`
4. Update `README.md` with feature description
5. Add to sidebar view in `package.json` → `contributes.viewsWelcome` if appropriate

#### For Configuration Changes
1. Add to `package.json` → `contributes.configuration.properties`
2. Document in `README.md` → Configuration section
3. Update `.github/copilot-instructions.md` if it affects development workflow

#### For Dependency Changes
- Update `.github/copilot-instructions.md` → External Dependencies section
- Explain purpose and integration approach
- Note any special configuration or usage patterns

### 4. Documentation Quality Standards

**Be Specific**: Include file paths, class names, and method signatures
**Be Actionable**: Provide concrete examples and code snippets
**Be Current**: Remove outdated information when making changes
**Be Consistent**: Use the same terminology across all documentation files

### 5. Verification Checklist

Before completing any changes, verify:

- [ ] All relevant documentation files have been updated
- [ ] Code examples in documentation match actual implementation
- [ ] New features are documented with usage examples
- [ ] Breaking changes are noted in CHANGELOG.md
- [ ] Configuration options are documented with defaults and descriptions
- [ ] Architecture diagrams or descriptions reflect current structure

### 6. Documentation Review Process

When making significant changes:

1. **Identify affected documentation** using the table above
2. **Update content** following the quality standards
3. **Cross-reference** to ensure consistency across files
4. **Test examples** to ensure they work with current codebase
5. **Commit documentation changes** with descriptive messages

## Important Notes

- **Never leave documentation outdated** - it's worse than no documentation. If in doubt leave a //TODO comment in the docs.
- **Update incrementally** - small, frequent updates are better than large overhauls
- **Focus on the "why"** - explain architectural decisions and design patterns
- **Include migration notes** when changing existing patterns or APIs
- **Maintain the user perspective** in README.md vs developer perspective in copilot-instructions.md

## Documentation Review Requirement

**All AI-generated or AI-modified JSDoc documentation MUST include `@lastreviewed null` flag:**

When AI agents create or modify JSDoc documentation, they must append `@lastreviewed null` to every method's documentation block. This serves as a placeholder indicating that human review is required. A human reviewer will replace `null` with the actual review date (e.g., `@lastreviewed 2025-09-16`) after verifying the documentation accuracy.

**Example:**
```typescript
/**
 * Processes user input and validates the data.
 * @param input The user input to process
 * @returns Processed and validated data
 * @lastreviewed null
 */
function processInput(input: string): ProcessedData {
  // implementation
}
```

This ensures all AI-generated documentation receives proper human oversight before being considered complete and accurate.

This ensures the codebase remains approachable for both users and developers, and that AI agents can effectively contribute to the project with proper context.