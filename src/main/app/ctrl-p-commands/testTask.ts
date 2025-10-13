import { ScriptUrlParser } from "../util/data/ScriptUrlParser";

export default async function () {
  const WEBDAV_URL = "https://templateassisted.myassn.com/files/1439716/draft/";
  const parser = new ScriptUrlParser(WEBDAV_URL);
  console.log(parser);
  try {
    const scriptName = await parser.getScriptName();
    console.log("scriptName", scriptName);
  } catch (e) {
    console.error(e);
  }
  
}