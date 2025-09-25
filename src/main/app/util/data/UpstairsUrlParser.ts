/**
 * Errors thrown when URL parsing fails.
 */
class URLParseError extends Error {
  constructor(message: string, public readonly input?: string) {
    super(message);
    this.name = 'URLParseError';
  }
}


export class UpstairsUrlParser {
  static readonly URL_TYPES = ['files', 'public'] as const;
  url: URL;
  type: typeof UpstairsUrlParser.URL_TYPES[number];
  webDavId: string;
  trailing?: string;
  constructor(public readonly rawUrlString: string) {
    if (!rawUrlString || !rawUrlString.trim()) {
      throw new URLParseError("URL string cannot be empty");
    }
    const str = rawUrlString.trim();
    try {
      this.url = new URL(str);
    } catch (error) {
      throw new URLParseError(`Invalid URL format: ${str}`);
    }

    const pathRegex = /^\/(files|public)\/(\d+)(?:\/(.*))?$/;
    const match = this.url.pathname.match(pathRegex);
    if (!match) {
      throw new URLParseError(`URL does not match expected BlueStep format: ${str}`);
    }
    const [, type, webDavId, trailing] = match;


    if (!/^\d+$/.test(webDavId) || webDavId.length > 10) {
      throw new URLParseError("the parsed WebDAV ID is probably too large to be legitimate");
    }

    // note that the typeguard informs TS of the type here
    if (!this.isValidType(type)) {
      throw new URLParseError(`Invalid path type: ${type}. Expected: ${UpstairsUrlParser.URL_TYPES.join(', ')}`);
    }
    this.type = type as typeof UpstairsUrlParser.URL_TYPES[number];
    this.webDavId = webDavId;
    this.trailing = trailing;
  }
  private isValidType(type: string): type is typeof UpstairsUrlParser.URL_TYPES[number] {
    return UpstairsUrlParser.URL_TYPES.includes(type as typeof UpstairsUrlParser.URL_TYPES[number]);
  }
}