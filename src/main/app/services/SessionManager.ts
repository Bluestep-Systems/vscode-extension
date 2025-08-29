import type { SessionData } from "../../../../types";
import { PrivateKeys, PrivatePersistanceMap } from "../util/data/PseudoMaps";
import { BasicAuthManager } from "./Auth";

export class SessionManager {
  private static MILLIS_IN_A_MINUTE = 1000 * 60;
  private static SESSION_DURATION = SessionManager.MILLIS_IN_A_MINUTE * 45;
  public static sessions: PrivatePersistanceMap<SessionData>;

  private static instance: SessionManager | null = null;
  private curDomain: string | null = null;
  private constructor() {
    SessionManager.sessions = new PrivatePersistanceMap(PrivateKeys.SESSIONS);
  }

  public static getInstance(): SessionManager {
    if (this.instance === null) {
      this.instance = new SessionManager();
    }
    return this.instance;
  }

  public processResponse(response: Response): Response {
    const cookies = response.headers.get("set-cookie");
    console.log("RESPONSE COOKIES", cookies);
    const responderUrl = new URL(response.url);
    if (cookies) {
      const cookieMap = this.parseCookies(cookies);
      console.log("Parsed Cookies", cookieMap);
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

    if (sessionData && sessionData.lastRefresh > Date.now() - SessionManager.SESSION_DURATION) {
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
  private parseCookies(cookies: string): Map<string, string> {
    const cookieMap = new Map<string, string>();
    
    // Split by comma to handle multiple Set-Cookie headers
    const cookieStrings = cookies.split(/,(?=[^;]+=[^;])/);
    console.log("Cookie Strings", cookieStrings);
    cookieStrings.forEach(cookieString => {
      // Split by semicolon to separate cookie value from attributes
      const parts = cookieString.split(";").map(part => part.trim());
      
      if (parts.length > 0) {
        // First part is the actual cookie name=value
        const cookiePart = parts[0];
        const equalIndex = cookiePart.indexOf("=");
        
        if (equalIndex > 0) {
          const name = cookiePart.substring(0, equalIndex).trim();
          const value = cookiePart.substring(equalIndex + 1).trim();
          
          // Only store if we have both name and value
          if (name && value) {
            cookieMap.set(name, value);
          }
        }
      }
    });
    
    return cookieMap;
  }
}
