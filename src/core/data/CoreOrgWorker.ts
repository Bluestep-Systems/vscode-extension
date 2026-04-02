import { ApiEndpoints, Http } from '../../main/resources/constants';
import { Err } from '../../main/app/util/Err';

/**
 * Core-layer helper for fetching organization info from a URL.
 *
 * Replaces the original `OrgWorker` which used the `HttpClient` singleton.
 * This version takes a `fetch` function parameter instead.
 */
export class CoreOrgWorker {

  private _U: string | null = null;

  constructor(
    private readonly rawUrl: URL,
    private readonly fetchFn: (url: string | URL, init?: RequestInit) => Promise<Response>,
  ) {}

  async getU(): Promise<string> {
    if (this._U !== null) {
      return this._U;
    }
    const newUrl = new URL(this.rawUrl);
    newUrl.pathname = ApiEndpoints.APPINFO_U;
    try {
      const response = await this.fetchFn(newUrl);
      if (!response.ok) {
        throw new Err.OrgWorkerError(`Failed to fetch user info from URL: ${newUrl.toString()}. Status: ${response.status}`);
      }
      this._U = await response.text();
      return this._U;
    } catch (error) {
      if (error instanceof Err.OrgWorkerError) {throw error;}
      throw new Err.OrgWorkerError(`Error fetching user info from URL: ${newUrl.toString()}\n ${error}`);
    }
  }

  async verifyU(u: string): Promise<boolean> {
    const fetchedU = await this.getU();
    return fetchedU === u;
  }

  static fromHost(
    host: string,
    fetchFn: (url: string | URL, init?: RequestInit) => Promise<Response>,
  ): CoreOrgWorker {
    const VALID_HOST_REGEX = /^(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)?$/;
    if (!VALID_HOST_REGEX.test(host)) {
      throw new Err.OrgWorkerError(`Invalid host: ${host}`);
    }
    const url = new URL(`${Http.Schemes.HTTPS}${host}`);
    return new CoreOrgWorker(url, fetchFn);
  }
}
