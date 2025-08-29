import type { SessionData } from "../../../../types";
import { PrivateKeys, PrivatePersistanceMap } from "../util/data/PseudoMaps";
import { BasicAuthManager } from "./Auth";

export class SessionManager {
  private static MILLIS_IN_A_MINUTE = 1000 * 60;
  private static SESSION_DURATION = SessionManager.MILLIS_IN_A_MINUTE * 5; // 5 minutes
  private static sessions: PrivatePersistanceMap<SessionData>;
  private static instance: SessionManager | null = null;
  private curDomain: string | null = null;
  private constructor() {
    SessionManager.sessions = new PrivatePersistanceMap(PrivateKeys.SESSIONS);
  }

  public static getSingleton(): SessionManager {
    if (this.instance === null) {
      this.instance = new SessionManager();
    }
    return this.instance;
  }

  public processResponse(response: Response): Response {
    const cookies = response.headers.get("set-cookie");
    const responderUrl = new URL(response.url);
    if (cookies) {
      const cookieMap = this.parseCookies(response.headers);
      const sessionData: SessionData = {
        lastRefresh: Date.now(),
        JSESSIONID: cookieMap.get("JSESSIONID") 
          || SessionManager.sessions.get(responderUrl.origin)?.JSESSIONID 
          || (() => {throw new Error("Missing JSESSIONID");})(),
        INGRESSCOOKIE: cookieMap.get("INGRESSCOOKIE") 
          || SessionManager.sessions.get(responderUrl.origin)?.INGRESSCOOKIE 
          || (() => {throw new Error("Missing INGRESSCOOKIE");})(),
      };
      SessionManager.sessions.set(responderUrl.origin, sessionData);
    }
    return response;
  }
  public async fetch(urlString: string | URL, options?: RequestInit): Promise<Response> {
    //apparently you can redundantly wrap a URL in a new constructor
    const url = new URL(urlString);
    const sessionData = SessionManager.sessions.get(url.origin);

    if (sessionData && (sessionData.lastRefresh > (Date.now() - SessionManager.SESSION_DURATION))) {
      console.log("Using cached session data");
      options = {
        ...options,
        headers: {
          ...options?.headers,
          "Cookie": `JSESSIONID=${sessionData.JSESSIONID}; INGRESSCOOKIE=${sessionData.INGRESSCOOKIE}`,
        }
      };
    } else {
      console.log("No cached session data found");
      options = {
        ...options,
        headers: {
          ...options?.headers,
          "Authorization": `${await BasicAuthManager.getSingleton().authHeaderValue()}`
        }
      };
    }
    const response = await fetch(urlString, options);
    return this.processResponse(response);
  }
  public endSession({ domain }: { domain: string }) {
    if (this.curDomain === domain) {
      this.curDomain = null;
      return void 0;
    }
    SessionManager.sessions.delete(domain);
  }

  /**
   * NOTE: this is not a proper cookie parser since we
   * do not care about attributes like `Secure` and `HttpOnly`
   * in this extension (yet). In the event that we do need such parsing
   * we should implement a more robust method and/or find some external library
   * @param cookies
   * @returns
   */
  private parseCookies(headers: Headers): Map<string, string> {
    const cookieMap = new Map<string, string>();

    const cookies = headers.get("set-cookie");
    if (!cookies) {
      return cookieMap;
    }
    // this regex will split on commas when there is a cookie ahead of it
    // it is because the response.headers.get("set-cookie") can return multiple
    // instances of the set-cookie header, but are separated by a comma
    const cookieStrings = cookies.split(/,(?=[^;]+=[^;])/);
    console.log("Cookie Strings", cookieStrings);
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
