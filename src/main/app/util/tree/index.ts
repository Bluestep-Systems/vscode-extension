import { UserCredentials } from "../UserManager";
import JsonPath from "../JsonPath";
import { RegexPatterns } from "./Regex";
import { SimpleNestedObject, XMLResponse } from "../../../../../types";
import { XMLParser } from 'fast-xml-parser';
import PutObjVal from "./PutObjVal";

type GetScriptArg = {
  url: URL;
  creds: UserCredentials;
  curLayer?: SimpleNestedObject<string>;
}
type GetScriptRet = { structure: SimpleNestedObject<string>; rawFiles: string[] };
export async function getScript({ url, creds, curLayer = {} }: GetScriptArg): Promise<GetScriptRet> {
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
        "authorization": `${creds.authHeaderValue()}`
      },
      "method": "PROPFIND"
    });
    const responseObj: XMLResponse = parser.parse(await response.text());
    const rawFiles = responseObj["D:multistatus"]["D:response"]
      .filter(terminal => {
        // get something less fragile
        return terminal["D:href"].indexOf("/snapshot/") === -1 && terminal["D:href"].indexOf("/.build/") === -1;
      }) 
      .map(terminal => {
        const url = new URL(terminal["D:href"]);
        const path = url.pathname.split("/");
        path.shift(); // first one is always empty string
        path.shift(); // second one is always "files"
        const newPath = path.join("/");
        const _webdavId = path.shift(); // may be useful somewhere
        if (path.at(-1)! === "") {
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
    //console.log(JSON.stringify(objToWork));

    console.log(responseObj);
    return { structure: curLayer, rawFiles };
  } catch (e) {
    console.trace(e);
    throw e;
  }

}

