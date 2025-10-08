import { ApiEndpoints, Http } from "../../../resources/constants";
import { SESSION_MANAGER as SM } from "../../b6p_session/SessionManager";
import { Err } from "../Err";

/**
 * Helper class for getting info from the org associated with a given URL.
 */
export class OrgWorker {
  
  constructor(private readonly rawUrl: URL) { }
  
  /**
   * Simply calls the org to get the U associated with the URL; this requires that the org is reachable.
   * @throws an {@link Err.BlueHqHelperEndpointError} if the fetch fails or the response is not OK.
   */
  async getU(): Promise<string> {
    const newUrl = new URL(this.rawUrl);
    newUrl.pathname = ApiEndpoints.APPINFO_U;
    try {
      const response = await SM.fetch(newUrl);
      if (!response.ok) {
        throw new Err.BlueHqHelperEndpointError(`Failed to fetch user info from URL: ${newUrl.toString()}. Status: ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      console.error("Error fetching user info:", error);
      throw new Err.BlueHqHelperEndpointError(`Error fetching user info from URL: ${newUrl.toString()}. ${error}`);
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
      throw new Err.BlueHqHelperEndpointError(`Invalid host: ${host}`);
    }
    const url = new URL(`${Http.Schemes.HTTPS}${host}`);
    return new OrgWorker(url);
  }
}