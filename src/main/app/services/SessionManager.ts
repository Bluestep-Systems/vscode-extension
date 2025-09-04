import type { SessionData } from "../../../../types";
import { Auth } from "../authentication";
import { PrivateKeys, PrivatePersistanceMap } from "../util/data/PseudoMaps";
import { ContextNode } from "./ContextNode";

export const SESSION_MANAGER = new class extends ContextNode {

  private readonly MILLIS_IN_A_MINUTE = 1000 * 60;
  private readonly MAX_SESSION_DURATION = this.MILLIS_IN_A_MINUTE * 5; // 5 minutes
  private readonly B6P_CSRF_TOKEN = 'b6p-csrf-token'; // lower case is important here
  protected persistence(){
    return this.sessions;
  }
  private _sessions: PrivatePersistanceMap<SessionData> | null = null;
  #parent: ContextNode | null = null;
  init(parent: ContextNode) {
    this.#parent = parent;
    if (this._sessions) {
      throw new Error("only one session manager may be initialized");
    }
    this._sessions = new PrivatePersistanceMap<SessionData>(PrivateKeys.SESSIONS, this.context);
    this.triggerNextCleanup(5_000); // TODO rethink if 5s is even needed
    Auth.BASIC_AUTH_MANAGER.init(this);
    return this;
  }

  public get parent() {
    if (!this.#parent) {
      throw new Error("SessionManager not initialized");
    }
    return this.#parent;
  }
  public get context() {
    if (!this.parent.context) {
      throw new Error("SessionManager not initialized");
    }
    return this.parent.context;
  }

  private get sessions() {
    if (!this._sessions) {
      throw new Error("SessionManager not initialized");
    }
    return this._sessions;
  }


  /**
   * Performs the normal managed fetch, however, wraps it with additional CSRF management,
   * complete with retries.
   * @param url 
   * @param options 
   * @param retries 
   * @returns 
   */
  public async csrfFetch(url: string | URL, options: RequestInit, retries = 3): Promise<Response> {
    url = new URL(url);
    const origin = url.origin;
    if (!this.sessions.has(origin)) {
      this.sessions.set(origin, { lastCsrfToken: null, INGRESSCOOKIE: null, JSESSIONID: null, lastTouched: Date.now() });
    }
    const session = this.sessions.get(origin);
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

      (options.headers as Record<string, string>)[this.B6P_CSRF_TOKEN] =
        session.lastCsrfToken
        || (() => { throw new Error("CSRF token not found"); })();

      let response = await fetch(url, options);

      // TODO: figure out why the get here is always returning empty
      // and why the for loop is needed
      let newToken = response.headers.get(this.B6P_CSRF_TOKEN);
      for (const [key, value] of Object.entries(response.headers)) {
        if (key === this.B6P_CSRF_TOKEN) {
          newToken = value;
        }
      }
      if (!newToken) {
        throw new Error("No CSRF token in response");
      }
      session.lastCsrfToken = newToken;
      this.sessions.set(origin, session);
      return response;
    } catch (e) {
      // Handle specific error types
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          throw new Error('Request timed out');
        }
        if (retries > 0) {
          console.log(`Request terminated, retrying... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          return this.csrfFetch(url, options, retries - 1);
        }
      }
      throw e;
    }
  }

  private processResponse(response: Response): Response {
    const cookies = response.headers.get("set-cookie");
    const responderUrl = new URL(response.url);
    if (cookies) {
      const cookieMap = this.parseCookies(response.headers);
      const sessionData: SessionData = {
        lastTouched: Date.now(),
        JSESSIONID: cookieMap.get("JSESSIONID")
          || this.sessions.get(responderUrl.origin)?.JSESSIONID
          || (() => { throw new Error("Missing JSESSIONID"); })(),
        INGRESSCOOKIE: cookieMap.get("INGRESSCOOKIE")
          || this.sessions.get(responderUrl.origin)?.INGRESSCOOKIE
          || (() => { throw new Error("Missing INGRESSCOOKIE"); })(),
        lastCsrfToken: this.sessions.get(responderUrl.origin)?.lastCsrfToken || null
      };
      this.sessions.set(responderUrl.origin, sessionData);
    }
    return response;
  }

  /**
   * performs a managed fetch. This is simply a wrapper for the standard `node.fetch(..args)`
   * where we merely append and manage the session cookies.
   * 
   * Does not automatically retry.
   * @param url 
   * @param options 
   * @returns 
   */
  public async fetch(url: string | URL, options?: RequestInit): Promise<Response> {
    url = new URL(url);
    const sessionData = this.sessions.get(url.origin);

    if (sessionData && (sessionData.lastTouched > (Date.now() - this.MAX_SESSION_DURATION))) {
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
          "Authorization": `${await Auth.BASIC_AUTH_MANAGER.authHeaderValue()}`
        }
      };
    }
    const response = await globalThis.fetch(url, options);
    return this.processResponse(response);
  }

  public clearSession({ origin }: { origin: string | URL }) {
    this.sessions.delete(new URL(origin).origin);
  }
  
  public clear() {
    this.sessions.clear();
  }
  public hasValidSession({ origin }: { origin: string | URL }): boolean {
    const session = this.sessions.get(new URL(origin).origin);
    return !!session && (session.lastTouched > (Date.now() - SESSION_MANAGER.MAX_SESSION_DURATION));
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

  private triggerNextCleanup(delay: number = SESSION_MANAGER.MAX_SESSION_DURATION) {
    setTimeout(() => {
      const now = Date.now();
      this.sessions.forEach((session, origin, sessions) => {
        if (now - session.lastTouched > SESSION_MANAGER.MAX_SESSION_DURATION) {
          sessions.delete(origin);
        }
      });
      this.triggerNextCleanup();
    }, delay);
  }
}();