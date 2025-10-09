import { MetaDataDotJsonContent } from "../../../../../types";
import { ApiEndpoints, SpecialFiles } from "../../../resources/constants";
import { SESSION_MANAGER as SM } from "../../b6p_session/SessionManager";
import { Err } from "../Err";
import { OrgWorker } from "./OrgWorker";


export class ScriptUrlParser {

  /**
   * The valid types of URL paths we can parse.
   */
  static readonly URL_TYPES = ['files', 'public'] as const;

  /**
   * The resultant URL object from the provided string.
   */
  url: URL;

  filesOrPublic: typeof ScriptUrlParser.URL_TYPES[number];

  /**
   * The WebDAV ID parsed from the URL.
   */
  webDavId: string;
  /**
   * The part of the path after the WebDAV ID, if any. will be something like `.gitignore` or `draft/objects/`, `declarations/scriptlibrary.d.ts` etc.
   * 
   * specifically, this does NOT include the leading slash.
   */
  trailing?: string;

  /**
   * If the trailing path includes a folder (i.e. has a slash in it), this is the first folder name.
   * For example, if the trailing path is `draft/objects/`, this will be `draft`.
   * If the trailing path is `declarations/scriptlibrary.d.ts`, this will be `declarations`.
   * If the trailing path is a file in the root (i.e. no slash), this will be `undefined`.
   */
  trailingFolder?: string;

  /**
   * The script name, as fetched from metadata.json. Will be `null` if not yet fetched.
   * 
   * This primarily exists to cache the result of getScriptName so we don't have to fetch it multiple times.
   */
  private _scriptName: string | null;

  /**
   * The OrgWorker instance used to fetch organization-specific data. Initialized on first use.
   */
  private _orgWorker: OrgWorker | null;

  constructor(public readonly rawUrlString: string) {
    this._scriptName = null;
    this._orgWorker = null;
    if (!rawUrlString || !rawUrlString.trim()) {
      throw new Err.UrlParsingError("URL string cannot be empty");
    }
    const str = rawUrlString.trim();
    try {
      this.url = new URL(str);
    } catch (error) {
      throw new Err.UrlParsingError(`Invalid URL format: ${str}`);
    }

    const pathRegex = /^\/(files|public)\/(\d+)(?:\/(.*))?$/;
    const match = this.url.pathname.match(pathRegex);
    if (!match) {
      throw new Err.UrlParsingError(`URL does not match expected BlueStep format: ${str}`);
    }
    const [, type, webDavId, trailing] = match;


    if (!/^\d+$/.test(webDavId) || webDavId.length > 10) {
      throw new Err.UrlParsingError("the parsed WebDAV ID is probably too large to be legitimate");
    }

    // note that the typeguard informs TS of the type here
    if (!this.isValidType(type)) {
      throw new Err.UrlParsingError(`Invalid path type: ${type}. Expected: ${ScriptUrlParser.URL_TYPES.join(', ')}`);
    }
    this.filesOrPublic = type as typeof ScriptUrlParser.URL_TYPES[number];
    this.webDavId = webDavId;
    this.trailing = trailing;
    this.trailingFolder = trailing?.includes('/') ? trailing.split('/')[0] : undefined;
  }

  /**
   * Checks to see if the provided type is on the list of valid types.
   */
  private isValidType(type: string): type is typeof ScriptUrlParser.URL_TYPES[number] {
    return ScriptUrlParser.URL_TYPES.includes(type as typeof ScriptUrlParser.URL_TYPES[number]);
  }

  /**
   * Fetches the "U" parameter for the organization associated with this URL.
   */
  public async getU(): Promise<string> {
    return await this.orgWorker().getU();
  }

  public async getScriptName(): Promise<string> {
    if (this._scriptName !== null) {
      return this._scriptName;
    }
    const metadataUrl = new URL(this.url.href);
    metadataUrl.pathname = `${ApiEndpoints.FILES}/${this.webDavId}/draft/info/${SpecialFiles.METADATA}`;
    const res = await SM.fetch(metadataUrl);
    if (!res.ok) {
      throw new Err.MetadataDotJsonFetchError(`Failed to fetch metadata from ${metadataUrl.href}: ${res.status} ${res.statusText}`);
    }
    try {
      const json = await res.json() as MetaDataDotJsonContent;
      this._scriptName = json.displayName;
      return this._scriptName;
    } catch (e) {
      throw new Err.MetadataDotJsonFetchError(`Failed to parse metadata JSON from ${metadataUrl.href}: ${(e as Error).message}`);
    }
  }

  public urlCopy(): URL {
    return new URL(this.url);
  }

  public orgWorker(): OrgWorker {
    if (this._orgWorker === null) {
      this._orgWorker = new OrgWorker(this.url);
    }
    return this._orgWorker;
  }
}