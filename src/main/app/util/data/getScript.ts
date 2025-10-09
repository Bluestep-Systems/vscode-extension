import { XMLParser } from 'fast-xml-parser';
import { XMLResponse } from "../../../../../types";
import { ApiEndpoints, FolderNames, Http, WebDAVElements } from "../../../resources/constants";
import { App } from "../../App";
import { SESSION_MANAGER as SM } from "../../b6p_session/SessionManager";
import { Alert } from "../ui/Alert";
import { ScriptUrlParser } from "./ScriptUrlParser";

type GetScriptRet = { upstairsPath: string; downstairsPath: string; trailing?: string; }[] | null;
type RawFiles = { upstairsPath: string; downstairsPath: string; trailing?: string; }[];
/**
 * Fetches the script from the specified URL.
 * @returns The structure and raw file paths of the fetched script, or undefined if not found.
 */
export async function getScript(parser: ScriptUrlParser): Promise<GetScriptRet> {
  try {
    const url = parser.urlCopy();
    url.pathname = `${ApiEndpoints.FILES}/${parser.webDavId}/`;
    App.logger.info("Fetching script from URL:", url.href);
    const scriptName = await parser.getScriptName();
    return await getSubScript(url, scriptName);
  } catch (e) {
    console.trace(e);
    throw e;
  }
}

async function getSubScript(url: URL, scriptName: string, repository: RawFiles = []): Promise<RawFiles | null> {
  try {
    const response = await SM.fetch(url, {
      //TODO review these
      "headers": {
        [Http.Headers.ACCEPT]: Http.Headers.ACCEPT_ALL,
        [Http.Headers.ACCEPT_LANGUAGE]: Http.Headers.ACCEPT_LANGUAGE_EN_US,
        [Http.Headers.CACHE_CONTROL]: Http.Headers.NO_CACHE,
        [Http.Headers.PRAGMA]: Http.Headers.NO_CACHE,
        [Http.Headers.UPGRADE_INSECURE_REQUESTS]: "1",
      },
      "method": Http.Methods.PROPFIND
    });
    if (!response.ok) {
      Alert.error(`Failed to fetch sub-script at ${url.href}: ${response.status} ${response.statusText}`);
      return null;
    }
    const parser = new XMLParser();
    const responseObj: XMLResponse = parser.parse(await response.text());
    const dResponses = responseObj[WebDAVElements.MULTISTATUS][WebDAVElements.RESPONSE];
    if (!dResponses.filter) {
      //this happens when we call for a folder and there are no files in it, so we just short-circuit.
      return repository;
    }
    const firstLayer: RawFiles = await Promise.all(dResponses
      .map(terminal => new ScriptUrlParser(terminal[WebDAVElements.HREF]))
      .filter(parser => {
        let { trailing, trailingFolder } = parser;
        // this is the folder itself, not a file or subfolder so it is meaningless to us
        if (trailing === undefined) {
          return false;
        }
        // don't pull snapshot elements
        if (trailingFolder === FolderNames.SNAPSHOT) {
          return false;
        }
        return true;
      })
      .map(async parser => {
        const { trailing, rawUrlString } = parser;
        const newPath = `${scriptName}/${trailing}`;
        return { upstairsPath: rawUrlString, downstairsPath: newPath, trailing };
      }));

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
        await getSubScript(subUrl, scriptName, repository);
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