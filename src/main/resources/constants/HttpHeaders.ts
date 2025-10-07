/**
 * HTTP header names and common header values.
 *
 * @lastreviewed 2025-10-07
 */
export namespace HttpHeaders {
  export const ACCEPT = "Accept";
  export const ACCEPT_LANGUAGE = "accept-language";
  export const AUTHORIZATION = "Authorization";
  export const CACHE_CONTROL = "cache-control";
  export const CONTENT_TYPE = "Content-Type";
  export const COOKIE = "Cookie";
  export const ETAG = "etag";
  export const PRAGMA = "pragma";
  export const SET_COOKIE = "set-cookie";
  export const UPGRADE_INSECURE_REQUESTS = "upgrade-insecure-requests";
  export const USER_AGENT = "User-Agent";
  export const B6P_CSRF_TOKEN = "b6p-csrf-token";

  // Common header values
  export const ACCEPT_ALL = "*/*";
  export const ACCEPT_LANGUAGE_EN_US = "en-US,en;q=0.9";
  export const NO_CACHE = "no-cache";
  export const USER_AGENT_B6P = "B6P-VSCode-Extension";
  export const GITHUB_API_ACCEPT = "application/vnd.github.v3+json";
}
