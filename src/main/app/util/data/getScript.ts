import { XMLParser } from 'fast-xml-parser';
import { PrimitiveNestedObject, XMLResponse } from "../../../../../types";
import { App } from "../../App";
import { SESSION_MANAGER } from "../../b6p_session/SessionManager";
import { Util } from "../";
import { Alert } from "../ui/Alert";
import { parseUrl } from "./URLParser";

type GetScriptArg = { url: URL; curLayer?: PrimitiveNestedObject; webDavId: string; }
type GetScriptRet = { structure: PrimitiveNestedObject; rawFilePaths: string[] } | undefined;

/**
 * Fetches the script from the specified URL.
 * @returns The structure and raw file paths of the fetched script, or undefined if not found.
 */
export async function getScript({ url, webDavId, curLayer = {} }: GetScriptArg): Promise<GetScriptRet> {
  try {
    url.pathname = `/files/${webDavId}/`;
    App.logger.info("Fetching script from URL:", url.href);
    const response = await SESSION_MANAGER.fetch(url, {
      //TODO review these
      "headers": {
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "upgrade-insecure-requests": "1",
      },
      "method": "PROPFIND"
    });
    if (!response.ok) {
      Alert.error(`Failed to fetch layer at ${url.href}: ${response.status} ${response.statusText}`);
      return;
    }
    App.logger.info("Response Status:", response.status);
    const parser = new XMLParser();
    const responseObj: XMLResponse = parser.parse(await response.text());
    App.logger.info("Response Object:", responseObj);
    //TODO remove magic strings
    const rawFiles = responseObj["D:multistatus"]["D:response"]
      //TODO this only goes 4 layers deep
      .filter(terminal => {
        // TODO examine this for fragility
        let { trailing } = parseUrl(terminal["D:href"]);
        if (trailing === undefined) {
          return false; // not pulling the root itself
        }
        const trailingParts = trailing.split("/");
        // skip shapshot folder
        if (trailingParts[0] === "snapshot") {
          return false;
        }
        // skip our .build folder. The user for some reason may still want one in subsequent paths
        if (trailingParts[1] === ".build") {
          return false;
        }
        return true;
      })
      .map(terminal => {
        const { webDavId, trailing } = parseUrl(terminal["D:href"]);

        const newPath = `${webDavId}/${trailing}`;
        const path = newPath.split("/");
        if (newPath.at(-1)! === "") {
          path.pop();
          Util.PutObjVal(curLayer, path, {}, "string");
        } else {
          const fileName = path.pop() as string;
          Util.PutObjVal(curLayer, path, { [`${fileName}`]: fileName }, "string");
        }
        return newPath;
      });
    if (!response.ok) {
      throw new Error(`Failed to fetch layer at ${url.href}: ${response.status} ${response.statusText}`);
    }
    return { structure: curLayer, rawFilePaths: rawFiles };
  } catch (e) {
    console.trace(e);
    throw e;
  }
}

