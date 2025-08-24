import { AuthManager, AuthType } from "../Auth";
import JsonPath from "../JsonPath";
import { PrimitiveNestedObject, XMLResponse } from "../../../../../types";
import { XMLParser } from 'fast-xml-parser';
import PutObjVal from "./PutObjVal";
import * as vscode from "vscode";
import { urlParser } from "../URLParser";

type GetScriptArg = {
  url: URL;
  authManager: AuthManager<AuthType>;
  curLayer?: PrimitiveNestedObject;
}
type GetScriptRet = { structure: PrimitiveNestedObject; rawFiles: string[] } | undefined;
export async function getScript({ url, authManager: creds, curLayer = {} }: GetScriptArg): Promise<GetScriptRet> {
  try {
    const parser = new XMLParser();
    const response = await fetch(url, {
      //TODO review these
      "headers": {
        "accept": "application/json",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "upgrade-insecure-requests": "1",
        "authorization": `${await creds.authHeaderValue()}`
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
      .filter(terminal => {
        // get something less fragile
        return terminal["D:href"].indexOf("/snapshot/") === -1 && terminal["D:href"].indexOf("/.build/") === -1;
      }) 
      .map(terminal => {
        const { url, webDavId, trailing } = urlParser(terminal["D:href"]);

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

