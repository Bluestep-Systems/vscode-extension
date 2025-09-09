class FileIOError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileIOError";
  }
}
export class FileReadError extends FileIOError {
  constructor(message: string) {
    super(message);
    this.name = "FileReadError";
  }
}
export class FileDoesNotExistError extends FileIOError {
  constructor(message: string) {
    super(message);
    this.name = "FileDoesNotExistError";
  }
}
