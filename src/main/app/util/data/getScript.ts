import { XMLParser } from 'fast-xml-parser';
import { PrimitiveNestedObject, XMLResponse } from "../../../../../types";
import { App } from "../../App";
import { SESSION_MANAGER as SM } from "../../b6p_session/SessionManager";
import { Alert } from "../ui/Alert";
import { parseUpstairsUrl } from "./URLParser";

type GetScriptArg = { url: URL; curLayer?: PrimitiveNestedObject; webDavId: string; }
type GetScriptRet = { upstairsPath: string; downstairsPath: string; trailing?: string }[] | null;
type RawFilesObj = { upstairsPath: string; downstairsPath: string; trailing?: string }[];
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

async function getSubScript(url: URL, repository: RawFilesObj = []): Promise<RawFilesObj | null> {
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
    const firstLayer: RawFilesObj = responseObj["D:multistatus"]["D:response"]
      .filter(terminal => {
        // TODO examine this for fragility
        let { trailing } = parseUpstairsUrl(terminal["D:href"]);
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
        const { webDavId, trailing } = parseUpstairsUrl(terminal["D:href"]);
        const newPath = `${webDavId}/${trailing}`;
        return { upstairsPath: terminal["D:href"], downstairsPath: newPath, trailing };
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
        const subLayer = await getSubScript(subUrl, repository);
        if (subLayer) {
          for (const subFile of subLayer) {
            if (repository.find(rf => rf.upstairsPath === subFile.upstairsPath)) {
              // Prevent duplicates
              continue;
            }
            repository.push(subFile);
          }
        }
      } else {
        repository.push(rawFile);
      }
    }
    return repository;
  } catch (e) {
    console.trace(e);
    throw e;
  }
}