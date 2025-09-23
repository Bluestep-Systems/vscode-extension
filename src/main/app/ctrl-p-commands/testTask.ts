import snapshot from './snapshot';

/**
 * TypeScript compiler worker that compiles the current file using TypeScript's programmatic API.
 * Outputs compiled JavaScript and declaration files to a specified location.
 */
export default async function () {
  snapshot();
}