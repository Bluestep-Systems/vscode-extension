/**
 * Errors thrown when URL parsing fails.
 */
class URLParseError extends Error {
  constructor(message: string, public readonly input?: string) {
    super(message);
    this.name = 'URLParseError';
  }
}
const URL_TYPES = ['files', 'public'] as const;
type UrlType = typeof URL_TYPES[number];
function isValidType(type: string): type is UrlType {
  return URL_TYPES.includes(type as UrlType);
}

export function parseUpstairsUrl(str: string): { url: URL; type: UrlType; webDavId: string; trailing?: string; } {

  if (!str || !str.trim()) {
    throw new URLParseError("URL string cannot be empty");
  }
  str = str.trim();

  let url: URL;
  try {
    url = new URL(str);
  } catch (error) {
    throw new URLParseError(`Invalid URL format: ${str}`);
  }

  const pathRegex = /^\/(files|public)\/(\d+)(?:\/(.*))?$/;
  const match = url.pathname.match(pathRegex);
  if (!match) {
    throw new URLParseError(`URL does not match expected BlueStep format: ${str}`);
  }
  const [, type, webDavId, trailing] = match;

  if (!/^\d+$/.test(webDavId) || webDavId.length > 10) {
    throw new URLParseError("the parsed WebDAV ID is probably too large to be legitimate");
  }

  // note that the typeguard informs TS of the type here
  if (!isValidType(type)) {
    throw new URLParseError(`Invalid path type: ${type}. Expected: ${URL_TYPES.join(', ')}`);
  }
  return {
    url,
    type, 
    webDavId,
    trailing
  };
}