import { Util } from '../util';
//@ts-ignore
import { Compiler } from '../util/script/Compiler';
import { ScriptFile } from '../util/script/ScriptFile';
//import { FileSystem } from "../util/fs/FileSystemFactory";
/**
 * TypeScript compiler worker that compiles the current file using TypeScript's programmatic API.
 * Outputs compiled JavaScript and declaration files to a specified location.
 */
//const fs = FileSystem.getInstance;
export default async function () {
  const activeUri = await Util.getDownstairsFileUri();
  const sf = ScriptFile.fromUri(activeUri);
  console.log("folderUri", sf.folder().path());
  // console.log(sf.pathWithRespectToDraftRoot());
  // const compiler = new ScriptCompiler(sf);
  // await compiler.compile();
}