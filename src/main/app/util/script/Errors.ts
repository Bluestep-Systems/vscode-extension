/**
 * @deprecated Use Err.FileReadError and Err.FileNotFoundError from ../Err instead
 * This file is kept for backwards compatibility during migration
 * @lastreviewed null
 */

import { Err } from "../Err";

/**
 * @deprecated Use Err.FileReadError instead
 */
export const FileReadError = Err.FileReadError;

/**
 * @deprecated Use Err.FileNotFoundError instead
 */
export const FileDoesNotExistError = Err.FileNotFoundError;
