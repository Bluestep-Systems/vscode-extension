import { App } from "../../App";
import { Err } from "../Err";
import { FileSystem } from "../fs/FileSystem";
import { ScriptNode } from "./ScriptNode";
import { SESSION_MANAGER as SM } from '../../b6p_session/SessionManager';
import { ResponseCodes } from "../network/StatusCodes";
const fs = FileSystem.getInstance;
export class ScriptFile extends ScriptNode {

  /**
   * Regex specifically for myassn document key patterns:
   */
  private static ComplexEtagPattern = /^"?\d{10,13}-\{.*?"class":\s*"myassn\.document\.(Proxy|LibraryServlet)MemoryDocumentKey".*?"classId":\s*\d+.*?\}"?$/;

  /**
   * Regex for standard etags (SHA-512 hashes).
   */
  private static EtagPattern = /^"[a-f0-9]{128}"$/;

  /**
   * Regex for "weak" etags (SHA-512 hashes).
   */
  private static WeakEtagPattern = /^W\/"[a-f0-9]{128}"$/;
  /**
   * Gets the lowercased SHA-512 hash of the local file.
   * @lastreviewed 2025-09-15
   */
  public async getHash(): Promise<string | null> {
    if (await this.isFolder()) {
      return null;
    }
    const bufferSource = await fs().readFile(this.uri());
    const localHashBuffer = await crypto.subtle.digest('SHA-512', bufferSource);
    const hexArray = Array.from(new Uint8Array(localHashBuffer));
    if (hexArray.length !== 64) {
      throw new Err.HashCalculationError();
    }
    return hexArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
  }
  /**
   * Gets the hash of the upstairs file, or `null` if it doesn't exist.
   * Extracts SHA-512 hash from the ETag header, handling both standard and weak ETags.
   * Complex ETags (from memory documents) are not supported and return null.
   * 
   * @param ops.required If true, throws an error when upstairs hash cannot be determined
   * @param ops.upstairsOverride Optional override URL to check instead of the default upstairs URL
   * @returns The SHA-512 hash string in lowercase, or `null` if file doesn't exist or has complex ETag
   * @lastreviewed 2025-09-15
   */
  public async getUpstairsHash(ops?: { required?: boolean, upstairsOverride?: URL }): Promise<string | null> {
    const response = await SM.fetch(ops?.upstairsOverride || this.toUpstairsURL(), {
      method: "HEAD"
    });
    const etagHeader = response.headers.get("etag");

    //some etags will come back with a complex pattern (the memory documents) and so we skip the etag check on them
    let etag: string | null = null;
    if (ScriptFile.EtagPattern.test(etagHeader || "")) {
      etag = JSON.parse(etagHeader?.toLowerCase() || "null");
    } else if (ScriptFile.WeakEtagPattern.test(etagHeader || "")) {
      // weak etags are prefixed with W/ and we ignore the weakness for our purposes
      App.isDebugMode() && console.log("weak etagHeader:", etagHeader);
      etag = JSON.parse(etagHeader?.substring(2).toLowerCase() || "null");
    } else {
      App.isDebugMode() && console.log("complex etagHeader:", etagHeader);
    }
    if (!etag) {
      if (ops?.required) {
        throw new Err.HashCalculationError();
      }
      //TODO determine if there is a legitimate reason that this could be undefined and we should throw an error instead
      // otherwise we can only assume it just doesn't exist upstairs
      return null;
    }
    return etag.toLowerCase();
  }

  /**
   * Checks if the local file's integrity matches the upstairs file.
   * Compares SHA-512 hashes between local and remote versions.
   * 
   * @param ops.upstairsOverride Optional override {@link URL} to check against instead of the default upstairs {@link URL}
   * @lastreviewed 2025-09-15
   */
  public async integrityMatches(ops?: { upstairsOverride?: URL }): Promise<boolean> {
    const localHash = await this.getHash();
    const upstairsHash = await this.getUpstairsHash(ops);
    const matches = localHash === upstairsHash;
    App.isDebugMode() && console.log("matches:", matches, "local:", localHash, "upstairs:", upstairsHash);
    return matches;
  }

  /**
     * Downloads the file from the upstairs location and writes it to the local file system.
     * Performs integrity verification using ETag headers and updates the lastPulled timestamp.
     * Skips download if the file is in .gitignore and removes it from metadata instead.
     * 
     * @returns Response object with status 418 if file is in .gitignore, otherwise the actual HTTP response
     * @throws {Error} When the download fails, integrity verification fails, or ETag parsing fails
     * @lastreviewed 2025-09-15
     */
  public async download(): Promise<Response> {
    const ignore = await this.isInGitIgnore();
    if (ignore) {
      App.logger.info(`not downloading \`${this.getFileName()}\` because in .gitignore`);
      await this.deleteFromMetadata();
      return new Response("", { status: ResponseCodes.TEAPOT });
    }
    const lookupUri = this.toUpstairsURL();
    App.logger.info("downloading from:" + lookupUri);
    const response = await SM.fetch(lookupUri, {
      method: "GET",
      headers: {
        "Accept": "*/*",
      }
    });
    if (response.status >= ResponseCodes.BAD_REQUEST) {
      App.logger.error(`Error fetching file ${lookupUri.toString()}: ${response.status} ${response.statusText}`);
      throw new Err.HttpResponseError(`Error fetching file ${lookupUri.toString()}: ${response.status} ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    await this.writeContent(buffer);
    const etagHeader = response.headers.get("etag");

    //TODO merge this with the other etag parsing code elsewhere in this class
    //some etags will come back with a complex pattern (the memory documents) and so we skip the etag check on them
    if (ScriptFile.EtagPattern.test(etagHeader || "")) {
      const etag = JSON.parse(etagHeader?.toLowerCase() || "null");
      const hash = await this.getHash();
      if (hash !== etag) {
        throw new Err.FileIntegrityError();
      }
    } else if (ScriptFile.WeakEtagPattern.test(etagHeader || "")) {
      // weak etags are prefixed with W/ and we ignore the weakness for our purposes
      App.isDebugMode() && console.log("weak etagHeader:", etagHeader);
      const etag = JSON.parse(etagHeader?.substring(2).toLowerCase() || "null");
      const hash = await this.getHash();
      if (hash !== etag) {
        throw new Err.FileIntegrityError();
      }
    } else if (ScriptFile.ComplexEtagPattern.test(etagHeader || "")) {
      App.isDebugMode() && console.log("complex etagHeader:", etagHeader);
      // complex etags are from the illusory document files and we skip the integrity check on them
    } else {
      throw new Err.EtagParsingError(etagHeader || 'null');
    }

    // touch the lastPulled time
    await this.touch("lastPulled");
    return response;
  }
  /**
  * Removes this file's record from the metadata push/pull tracking.
  * @lastreviewed 2025-09-15
  */
  private async deleteFromMetadata() {
    await this.getScriptRoot().modifyMetaData((md) => {
      const index = md.pushPullRecords.findIndex(record => record.downstairsPath === this.uri().fsPath);
      if (index !== -1) {
        md.pushPullRecords.splice(index, 1);
      }
    });
  }
  /**
   * Deletes the script file from metadata and the local file system.
   * @throws {Error} When the file does not exist
   * @lastreviewed 2025-09-18
   */
  public async delete() {
    await super.delete();
    await this.deleteFromMetadata();
  }
}