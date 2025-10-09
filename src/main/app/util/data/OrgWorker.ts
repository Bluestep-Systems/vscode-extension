import { ApiEndpoints, Http } from "../../../resources/constants";
import { Err } from "../Err";
import { HttpClient } from "../network/HttpClient";

/**
 * Helper class for getting info from the org associated with a given URL.
 */
export class OrgWorker {

  /**
   * The U associated with the URL, once fetched. null if not yet fetched.
   */
  private _U: string | null;

  constructor(private readonly rawUrl: URL) {
    this._U = null;
  }

  /**
   * Simply calls the org (sans session management) to get the U associated with the URL; this requires that the org is reachable.
   * @throws an {@link Err.OrgWorkerError} if the fetch fails or the response is not OK.
   */
  async getU(): Promise<string> {
    if (this._U !== null) {
      return this._U;
    }
    const newUrl = new URL(this.rawUrl);
    newUrl.pathname = ApiEndpoints.APPINFO_U;
    try {
      // we use the HttpClient here directly because we don't want to involve session management
      // because it would automatically pass auth headers and thus create a potential security risk.
      const response = await HttpClient.getInstance().fetch(newUrl);
      if (!response.ok) {
        throw new Err.OrgWorkerError(`Failed to fetch user info from URL: ${newUrl.toString()}. Status: ${response.status}`);
      }
      this._U = await response.text();
      return this._U;
    } catch (error) {
      console.error("Error fetching user info:", error);
      throw new Err.OrgWorkerError(`Error fetching user info from URL: ${newUrl.toString()}\n ${error}`);
    }
  }

  /**
   * Verifies that the provided U matches the U associated with the URL.
   */
  async verifyU(u: string): Promise<boolean> {
    const fetchedU = await this.getU();
    // Implementation for verifying the U can be added here
    return fetchedU === u;
  }

  /**
   * Creates an OrgWorker for the given host, after validating the host string.
   * @param host The host to create an OrgWorker for.
   */
  static fromHost(host: string): OrgWorker {
    const VALID_HOST_REGEX = /^(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)?$/;
    if (!VALID_HOST_REGEX.test(host)) {
      throw new Err.OrgWorkerError(`Invalid host: ${host}`);
    }
    const url = new URL(`${Http.Schemes.HTTPS}${host}`);
    return new OrgWorker(url);
  }
}