import { HttpSchemes } from "./HttpSchemes";

/**
 * BlueHQ base URLs and endpoints.
 *
 * @lastreviewed 2025-10-07
 */
export namespace BlueHQ {
  export const HOST = "bluehq.bluestep.net";
  export const HELPER_ENDPOINT = "/b/vscode_extension_helper";
  export const ENDPOINT = HttpSchemes.HTTPS + HOST + HELPER_ENDPOINT;
}
