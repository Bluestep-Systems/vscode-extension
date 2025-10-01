import { Err } from "../Err";



export class UpstairsUrlParser {

  static readonly URL_TYPES = ['files', 'public'] as const;

  url: URL;

  filesOrPublic: typeof UpstairsUrlParser.URL_TYPES[number];
  
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

  constructor(public readonly rawUrlString: string) {
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
      throw new Err.UrlParsingError(`Invalid path type: ${type}. Expected: ${UpstairsUrlParser.URL_TYPES.join(', ')}`);
    }
    this.filesOrPublic = type as typeof UpstairsUrlParser.URL_TYPES[number];
    this.webDavId = webDavId;
    this.trailing = trailing;
    this.trailingFolder = trailing?.includes('/') ? trailing.split('/')[0] : undefined;
  }
  public async getU(): Promise<string> {
    return Promise.resolve(this.url.hostname.split('.')[0]);
  }
  private isValidType(type: string): type is typeof UpstairsUrlParser.URL_TYPES[number] {
    return UpstairsUrlParser.URL_TYPES.includes(type as typeof UpstairsUrlParser.URL_TYPES[number]);
  }
}