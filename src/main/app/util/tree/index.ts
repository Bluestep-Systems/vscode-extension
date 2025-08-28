import { AuthManager, AuthType } from "../../services/Auth";
import { PrimitiveNestedObject, XMLResponse } from "../../../../../types";
import { XMLParser } from 'fast-xml-parser';
import PutObjVal from "./PutObjVal";
import * as vscode from "vscode";
import { urlParser } from "../data/URLParser";
type GetScriptArg = {
  url: URL;
  authManager: AuthManager<AuthType>;
  curLayer?: PrimitiveNestedObject;
  webDavId: string;
}
type GetScriptRet = { structure: PrimitiveNestedObject; rawFiles: string[] } | undefined;
export async function getScript({ url, webDavId, authManager, curLayer = {} }: GetScriptArg): Promise<GetScriptRet> {
  try {
    const parser = new XMLParser();
    console.log("Fetching script from URL:", url.href);
    url.pathname = `/files/${webDavId}/`;
    console.log("Fetching script from URL:", url.href);
    const response = await fetch(url, {
      //TODO review these
      "headers": {
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "upgrade-insecure-requests": "1",
        "authorization": `${await authManager.authHeaderValue()}`
      },
      "method": "PROPFIND"
    });
    if (!response.ok) {
      vscode.window.showErrorMessage(`Failed to fetch layer at ${url.href}: ${response.status} ${response.statusText}`);
      return;
    }
    console.log("Response Status:", response.status);
    const responseObj: XMLResponse = parser.parse(await response.text());
    console.log("Response Object:", responseObj);
    const rawFiles = responseObj["D:multistatus"]["D:response"]
      //TODO this only goes 4 layers deep
      .filter(terminal => {
        // get something less fragile 
        return terminal["D:href"].indexOf("/snapshot/") === -1 && terminal["D:href"].indexOf("/.build/") === -1;
      }) 
      .map(terminal => {
        const { webDavId, trailing } = urlParser(terminal["D:href"]);

        const newPath = `${webDavId}/${trailing}`; 
        const path = newPath.split("/");
        if (newPath.at(-1)! === "") {
          path.pop();
          PutObjVal(curLayer, path, {}, "string");
        } else {
          const fileName = path.pop();
          PutObjVal(curLayer, path, { [`${fileName}`]: fileName }, "string");
        }
        return newPath;
      });
    if (!response.ok) {
      throw new Error(`Failed to fetch layer at ${url.href}: ${response.status} ${response.statusText}`);
    }
    return { structure: curLayer, rawFiles };
  } catch (e) {
    console.trace(e);
    throw e;
  }

}

