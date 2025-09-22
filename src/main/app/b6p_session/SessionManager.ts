import type { SessionData } from "../../../../types";
import { Auth, AuthManager, AuthObject } from "../authentication";
import { PrivateKeys, PrivateGenericMap } from "../util/PseudoMaps";
import { ContextNode } from "../context/ContextNode";
import { Alert } from "../util/ui/Alert";
import { Util } from "../util";
import { App } from "../App";
import { ResponseCodes } from "../util/network/StatusCodes";

/**
 * The session manager is responsible for managing individual sessions with BlueStep servers.
 */
export const SESSION_MANAGER = new class extends ContextNode {


  /**
   * Number of milliseconds in a minute. Useful for shorthanding some things in this class.
   */
  private readonly MILLIS_IN_A_MINUTE = 1000 * 60;

  /**
   * Maximum duration of a session before it is considered expired and needs to be re-authenticated.
   */
  private readonly MAX_SESSION_DURATION = this.MILLIS_IN_A_MINUTE * 30; // 30 minutes

  /**
   * Maximum number of retry attempts for fetch requests that fail due to network issues or authentication problems.
   */
  private readonly MAX_RETRY_ATTEMPTS = 3;

  /**
   * Maximum age of a CSRF token before it is considered stale and needs to be refreshed.
   * 
   * //TODO: re-enable this once we have a better sense of how often tokens actually expire.
   */
  //private readonly MAX_CSRF_TOKEN_AGE = this.MILLIS_IN_A_MINUTE * 1; // 1 minutes

  /**
   * The name of the CSRF token header used by BlueStep.
   */
  private readonly B6P_CSRF_TOKEN = 'b6p-csrf-token'; // lower case is important here because the response headers are lower-cased

  /**
   * The AuthManager used for authentication.
   */
  #authManager: AuthManager<AuthObject> | null = null;

  /**
   * Returns the persistence map for the session data.
   * @returns The persistence map for the session data.
   */
  protected map() {
    return this.sessions;
  }

  /**
   * The persistence map for the session data. Largely used as alias for the `persistence()` method.
   */
  #sessions: PrivateGenericMap<SessionData> | null = null;

  /**
   * The ancestor context node that is used to instantiate this manager
   */
  #parent: typeof App | null = null;

  /**
   * Initializes the session manager.
   * @param parent The ancestor context node that is used to instantiate this manager.
   * @returns The initialized session manager.
   */
  init(parent: typeof App) {
    this.#parent = parent;
    if (this.#sessions) {
      throw new Error("only one session manager may be initialized");
    }
    this.#sessions = new PrivateGenericMap<SessionData>(PrivateKeys.SESSIONS, this.context);
    this.triggerNextCleanup(5_000); // TODO rethink if 5s is even needed
    Auth.initManagers(this);
    this.#authManager = Auth.determineManager();
    return this;
  }

  /**
   * The AuthManager used for authentication.
   */
  public get authManager() {
    if (!this.#authManager) {
      throw new Error("AuthManager not initialized");
    }
    return this.#authManager;
  }

  /**
   * The ancestor context node that was used to instantiate this manager
   */
  public get parent() {
    if (!this.#parent) {
      throw new Error("SessionManager not initialized");
    }
    return this.#parent;
  }

  /**
   * The vscode extension context from the ancestor context node.
   */
  public get context() {
    if (!this.parent.context) {
      throw new Error("SessionManager not initialized");
    }
    return this.parent.context;
  }

  /**
   * The persistence map for the session data.
   */
  private get sessions() {
    if (!this.#sessions) {
      throw new Error("SessionManager not initialized");
    }
    return this.#sessions;
  }


  /**
   * Performs the normal managed fetch, however, wraps it with additional CSRF management,
   * complete with retries.
   * @param url 
   * @param options 
   * @param retries 
   * @returns 
   */
  public async csrfFetch(url: string | URL, options?: RequestInit, retries = this.MAX_RETRY_ATTEMPTS): Promise<Response> {
    url = new URL(url);
    const origin = url.origin;
    if (!this.sessions.has(origin)) {
      await this.sessions.set(origin, { lastCsrfToken: null, INGRESSCOOKIE: null, JSESSIONID: null, lastTouched: Date.now() });
    }
    const session = this.sessions.get(origin);
    if (!session) {
      throw new Error("Session not found for origin: " + origin);
    }

    try {
      //TODO figure out why we it will sometimes error out with this if-check
      //if (!session.lastCsrfToken || session.lastTouched < (Date.now() - this.MAX_CSRF_TOKEN_AGE)) {
      const tokenValue = await this.fetch(`${origin}/csrf-token`).then(r => r.text());
      session.lastCsrfToken = tokenValue;
      await this.sessions.set(origin, session);
      await this.sessions.store(); // TODO find why this keeps being needed
      //}

      options = options || {};
      options.headers = options.headers || {};

      (options.headers as Record<string, string>)[this.B6P_CSRF_TOKEN] =
        session.lastCsrfToken
        || (() => { throw new Error("CSRF token not found"); })();
      let response = await this.fetch(url, options);
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
      await this.sessions.set(origin, session);
      return response;
    } catch (e) {
      if (retries <= 0) {
        console.trace(e);
        throw new SessionError("Retry attempts exhausted: " + (e instanceof Error ? e.stack || e.message : String(e)));
      }
      // Handle specific error types
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          throw new Error('Request timed out');
        }
        if (e instanceof UnauthorizedError) {
          await this.sessions.delete(origin);
          Alert.info(e.stack || e.message || String(e), { modal: false });
          Alert.info("Session expired/etc, attempting to re-authenticate...", { modal: false });
          await Util.sleep((this.MAX_RETRY_ATTEMPTS + 1 - retries) * 1_000); // (expanding) pause before retrying
          return await this.csrfFetch(url, options, retries - 1);
        }
        if (retries > 0) {
          session.lastCsrfToken = null; // force a refresh
          Alert.info(`Request didn't work, retrying... (${retries} attempts left)`, { modal: false });
          await this.sessions.delete(origin);
          await Util.sleep((this.MAX_RETRY_ATTEMPTS + 1 - retries) * 1_000); // (expanding) pause before retrying
          return await this.csrfFetch(url, options, retries - 1);
        }
      }
      throw e;
    }
  }

  /**
   * Common code for processing and storing session data from a fetch response.
   * 
   * This includes extracting cookies and CSRF tokens from the response headers
   * and updating the session data accordingly.
   * @param response 
   * @returns 
   */
  private async processResponse(response: Response): Promise<Response> {
    if (response.status === ResponseCodes.FORBIDDEN) {
      throw new UnauthorizedError(`HTTP Error: ${response.status} ${response.statusText}`);
    }
    const cookies = response.headers.get("set-cookie");
    const responderUrl = new URL(response.url);
    if (cookies) {
      const cookieMap = this.parseCookies(response.headers);
      const sessionData: SessionData = {
        lastTouched: Date.now(),
        JSESSIONID: cookieMap.get("JSESSIONID")
          || this.sessions.get(responderUrl.origin)?.JSESSIONID
          || (() => { throw new ResponseError("Missing JSESSIONID"); })(),
        INGRESSCOOKIE: cookieMap.get("INGRESSCOOKIE")
          || this.sessions.get(responderUrl.origin)?.INGRESSCOOKIE
          || null,
        lastCsrfToken: response.headers.get(this.B6P_CSRF_TOKEN)
          || this.sessions.get(responderUrl.origin)?.lastCsrfToken
          || null
      };
      await this.sessions.set(responderUrl.origin, sessionData);
    } else {
      const existing = this.sessions.get(responderUrl.origin);
      if (!existing) {
        throw new ResponseError("No existing session data found, and no cookies in response");
      }
      existing.lastTouched = Date.now();
      existing.lastCsrfToken = response.headers.get(this.B6P_CSRF_TOKEN) || existing.lastCsrfToken;
      await this.sessions.set(responderUrl.origin, existing);
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
    if (sessionData && (sessionData.JSESSIONID) && (sessionData.lastTouched > (Date.now() - this.MAX_SESSION_DURATION))) {
      App.isDebugMode() && App.logger.info("using existing session for fetch to:" + url.href + "\n " + JSON.stringify(sessionData));
      options = {
        ...options,
        headers: {
          ...options?.headers,
          "Cookie": `JSESSIONID=${sessionData.JSESSIONID}; INGRESSCOOKIE=${sessionData.INGRESSCOOKIE}`,
        }
      };
      const response = await globalThis.fetch(url, options);
      return await this.processResponse(response);
    } else {
      App.logger.info("performing login to:" + url.origin);
      //TODO perform this login on a more dedicated endpoint (graphql?)
      const authLoginBodyValue = await this.authManager.authLoginBodyValue();
      App.isDebugMode() && App.logger.info("login body:" + authLoginBodyValue);
      const response = await globalThis.fetch(url.origin + "/lookup/test", {
        method: "POST",
        headers: {
          "Authorization": `${await this.authManager.authHeaderValue()}`,
        }
      });
      App.logger.info("login status:" + response.status);
      if (response.status >= ResponseCodes.BAD_REQUEST) {
        throw new SessionError(`HTTP Error: ${response.status} ${response.statusText}`);
      }
      await this.processResponse(response);
      return await this.fetch(url, options);

    }
  }

  /**
   * Clears the session data for a specific origin. Parses any URL strings and
   * extracts the origin as needed.
   * @param param0 The origin for which to clear the session data.
   */
  public clearSession({ origin }: { origin: string | URL }) {
    this.sessions.delete(new URL(origin).origin);
  }

  /**
   * Checks if there is a valid session for a specific origin.
   * @param param0 The origin to check for a valid session.
   * @returns True if a valid session exists, false otherwise.
   */
  public hasValidSession({ origin }: { origin: string | URL }): boolean {
    const session = this.sessions.get(new URL(origin).origin);
    return !!session && (session.lastTouched > (Date.now() - this.MAX_SESSION_DURATION));
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
    const setCookies = headers.getSetCookie();
    setCookies.forEach(cookieString => {
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

  /**
   * Triggers the next cleanup of expired sessions.
   * @param delay The delay before the next cleanup is triggered; defaults to {@link MAX_SESSION_DURATION}.
   */
  private triggerNextCleanup(delay: number = this.MAX_SESSION_DURATION) {
    setTimeout(() => {
      const now = Date.now();
      this.sessions.forEach((session, origin, sessions) => {
        if (now - session.lastTouched > this.MAX_SESSION_DURATION) {
          sessions.delete(origin);
        }
      });
      this.triggerNextCleanup();
    }, delay);
  }
}();

class SessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionError";
  }
}

class UnauthorizedError extends SessionError {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

class ResponseError extends SessionError {
  constructor(message: string) {
    super(message);
    this.name = "ResponseError";
  }
}