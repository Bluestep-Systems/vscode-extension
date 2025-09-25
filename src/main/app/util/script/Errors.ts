/**
 * Base class for file I/O related errors.
 * @lastreviewed null
 */
class FileIOError extends Error {
  /**
   * Creates a new FileIOError instance.
   * @param message The error message
   * @lastreviewed null
   */
  constructor(message: string) {
    super(message);
    this.name = "FileIOError";
  }
}

/**
 * Error thrown when a file read operation fails.
 * @lastreviewed null
 */
export class FileReadError extends FileIOError {
  /**
   * Creates a new FileReadError instance.
   * @param message The error message describing the read failure
   * @lastreviewed null
   */
  constructor(message: string) {
    super(message);
    this.name = "FileReadError";
  }
}

/**
 * Error thrown when attempting to access a file that does not exist.
 * @lastreviewed null
 */
export class FileDoesNotExistError extends FileIOError {
  /**
   * Creates a new FileDoesNotExistError instance.
   * @param message The error message describing the missing file
   * @lastreviewed null
   */
  constructor(message: string) {
    super(message);
    this.name = "FileDoesNotExistError";
  }
}
