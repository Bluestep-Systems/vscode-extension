import type { SessionData } from "../../../../types";

import { PrivateKeys, PrivatePersistanceMap } from "../util/data/PseudoMaps";
import { BasicAuthManager } from "./Auth";

export namespace SessionManager {
  
  const MILLIS_IN_A_MINUTE = 1000 * 60;
  const SESSION_DURATION = MILLIS_IN_A_MINUTE * 5; // 5 minutes
  const B6P_CSRF_TOKEN = 'b6p-csrf-token'; // lower case is important here
  let sessions: PrivatePersistanceMap<SessionData> | null = null;
  export function init() {
    sessions = new PrivatePersistanceMap<SessionData>(PrivateKeys.SESSIONS);
  }
  function getSessions() {
    if (!sessions) {
      throw new Error("SessionManager not initialized");
    }
    return sessions;
  }
  export const csrf = {
    fetch: async (url: string | URL, options: RequestInit, retries = 3): Promise<Response> => {
      url = new URL(url);
      const origin = url.origin;
      if (!getSessions().has(origin)) {
        getSessions().set(origin, { lastCsrfToken: null, INGRESSCOOKIE: null, JSESSIONID: null, lastTouched: Date.now() });
      }
      const session = getSessions().get(origin);
      if (!session) {
        throw new Error("Session not found for origin: " + origin);
      }

      try {
        if (!session.lastCsrfToken) {
          const tokenValue = await fetch(`${origin}/csrf-token`).then(r => r.text());
          session.lastCsrfToken = tokenValue;
        }

        options = options || {};
        options.headers = options.headers || {};

        (options.headers as Record<string, string>)[B6P_CSRF_TOKEN] = 
          session.lastCsrfToken 
          || (() => { throw new Error("CSRF token not found"); })();

        let response = await fetch(url, options);

        // TODO: figure out why the get here is always returning empty
        // and why the for loop is needed
        let newToken = response.headers.get(B6P_CSRF_TOKEN);
        for (const [key, value] of Object.entries(response.headers)) {
          if (key === B6P_CSRF_TOKEN) {
            newToken = value;
          }
        }
        if (!newToken) {
          throw new Error("No CSRF token in response");
        }
        session.lastCsrfToken = newToken;
        getSessions().set(origin, session);
        return response;
      } catch (e) {
        // Handle specific error types
        if (e instanceof Error) {
          if (e.name === 'AbortError') {
            throw new Error('Request timed out');
          }
          if (e.message.includes('terminated') && retries > 0) {
            console.log(`Request terminated, retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            return csrf.fetch(url, options, retries - 1);
          }
        }
        throw e;
      }
    }
  };

  export function processResponse(response: Response): Response {
    const cookies = response.headers.get("set-cookie");
    const responderUrl = new URL(response.url);
    if (cookies) {
      const cookieMap = parseCookies(response.headers);
      const sessionData: SessionData = {
        lastTouched: Date.now(),
        JSESSIONID: cookieMap.get("JSESSIONID") 
          || getSessions().get(responderUrl.origin)?.JSESSIONID 
          || (() => {throw new Error("Missing JSESSIONID");})(),
        INGRESSCOOKIE: cookieMap.get("INGRESSCOOKIE") 
          || getSessions().get(responderUrl.origin)?.INGRESSCOOKIE 
          || (() => {throw new Error("Missing INGRESSCOOKIE");})(),
        lastCsrfToken: getSessions().get(responderUrl.origin)?.lastCsrfToken || null
      };
      getSessions().set(responderUrl.origin, sessionData);
    }
    return response;
  }

  export async function fetch(urlString: string | URL, options?: RequestInit): Promise<Response> {
    //apparently you can redundantly wrap a URL in a new constructor
    const url = new URL(urlString);
    const sessionData = getSessions().get(url.origin);

    if (sessionData && (sessionData.lastTouched > (Date.now() - SESSION_DURATION))) {
      options = {
        ...options,
        headers: {
          ...options?.headers,
          "Cookie": `JSESSIONID=${sessionData.JSESSIONID}; INGRESSCOOKIE=${sessionData.INGRESSCOOKIE}`,
        }
      };
    } else {
      options = {
        ...options,
        headers: {
          ...options?.headers,
          "Authorization": `${await BasicAuthManager.getSingleton().authHeaderValue()}`
        }
      };
    }
    const response = await globalThis.fetch(urlString, options);
    return processResponse(response);
  }

  export function endSession({ origin }: { origin: string }) {
    getSessions().delete(origin);
  }

  /**
   * NOTE: this is not a proper cookie parser since we
   * do not care about attributes like `Secure` and `HttpOnly`
   * in this extension (yet). In the event that we do need such parsing
   * we should implement a more robust method and/or find some external library
   * @param cookies
   * @returns
   */
  function parseCookies(headers: Headers): Map<string, string> {
    const cookieMap = new Map<string, string>();

    const cookies = headers.get("set-cookie");
    if (!cookies) {
      return cookieMap;
    }
    // this regex will split on commas when there is a cookie ahead of it
    // it is because the response.headers.get("set-cookie") can return multiple
    // instances of the set-cookie header, but are separated by a comma
    const cookieStrings = cookies.split(/,(?=[^;]+=[^;])/);
    cookieStrings.forEach(cookieString => {
      const parts = cookieString.split(";").map(part => part.trim());
      
      if (parts.length > 0) {
        const cookiePart = parts[0];
        const equalIndex = cookiePart.indexOf("=");
        
        if (equalIndex > 0) {
          const name = cookiePart.substring(0, equalIndex).trim();
          const value = cookiePart.substring(equalIndex + 1).trim();

          // we only care about name=value pairs
          if (name && value) {
            cookieMap.set(name, value);
          }
        }
      }
    });
    
    return cookieMap;
  }
}
