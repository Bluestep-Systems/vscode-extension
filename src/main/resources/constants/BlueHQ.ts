import { HttpSchemes } from "./HttpSchemes";

/**
 * BlueHQ base URLs and endpoints.
 *
 * @lastreviewed 2025-10-07
 */
export namespace BlueHQ {
  /**
   * 
   */
  export const HOST = "bluehq.bluestep.net";
  /**
   * The BlueHQ helper endpoint path.
   */
  export const ENDPOINT_PATH = "/b/vscode_extension_helper";
  /**
   * creates a new instance of the BlueHQ helper endpoint URL.
   */
  export const ENDPOINT = () => new URL(HttpSchemes.HTTPS + HOST + ENDPOINT_PATH);


  export const getAnyDomainUrl = () => {
    const url = ENDPOINT();
    url.searchParams.set(Actions.PARAM_NAME, Actions.GET_ANY_DOMAIN);
    return url;
  };

  namespace Actions {
    export const PARAM_NAME = "action";
    export const GET_ANY_DOMAIN = "getAnyDomain";
  }
}
