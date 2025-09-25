import { XMLParser } from 'fast-xml-parser';
import { PrimitiveNestedObject, XMLResponse } from "../../../../../types";
import { App } from "../../App";
import { SESSION_MANAGER as SM } from "../../b6p_session/SessionManager";
import { Alert } from "../ui/Alert";
import { UpstairsUrlParser } from "./UpstairsUrlParser";

type GetScriptArg = { url: URL; curLayer?: PrimitiveNestedObject; webDavId: string; }
type GetScriptRet = { upstairsPath: string; downstairsPath: string; trailing?: string }[] | null;
type RawFiles = { upstairsPath: string; downstairsPath: string; trailing?: string }[];
/**
 * Fetches the script from the specified URL.
 * @returns The structure and raw file paths of the fetched script, or undefined if not found.
 */
export async function getScript({ url, webDavId }: GetScriptArg): Promise<GetScriptRet> {
  try {
    url.pathname = `/files/${webDavId}/`;
    App.logger.info("Fetching script from URL:", url.href);
    return await getSubScript(url);
  } catch (e) {
    console.trace(e);
    throw e;
  }
}

async function getSubScript(url: URL, repository: RawFiles = []): Promise<RawFiles | null> {
  try {
    const response = await SM.fetch(url, {
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
      Alert.error(`Failed to fetch sub-script at ${url.href}: ${response.status} ${response.statusText}`);
      return null;
    }
    const parser = new XMLParser();
    const responseObj: XMLResponse = parser.parse(await response.text());
    const dResponses = responseObj["D:multistatus"]["D:response"];
    if (!dResponses.filter) {
      //this happens when we call for a folder and there are no files in it, so we just short-circuit.
      return repository;
    }
    const firstLayer: RawFiles = dResponses
      .map(terminal => new UpstairsUrlParser(terminal["D:href"]))
      .filter(parser => {
        let { trailing, trailingFolder } = parser;
        // this is the folder itself, not a file or subfolder so it is meaningless to us
        if (trailing === undefined) {
          return false; 
        }
        // don't pull snapshot elements
        if (trailingFolder === "snapshot") {
          return false; 
        }
        return true;
      })
      .map(parser => {
        const { webDavId, trailing, rawUrlString } = parser;
        const newPath = `${webDavId}/${trailing}`;
        return { upstairsPath: rawUrlString, downstairsPath: newPath, trailing };
      });
    
    for (const rawFile of firstLayer) {
      if (repository.find(rf => rf.upstairsPath === rawFile.upstairsPath)) {
        // Prevent duplicates
        continue;
      }
      if (rawFile.trailing?.endsWith('/')) {
        // This is a directory; recurse into it
        const subUrl = new URL(rawFile.upstairsPath);
        
        if (subUrl.toString() === url.toString()) {
          repository.push(rawFile);
          continue;
        }
        await getSubScript(subUrl, repository);
      } else {
        repository.push(rawFile);
      }
    }
    return repository;
  } catch (e) {
    console.error("error getting url", url.toString());
    console.trace(e);
    throw e;
  }
}