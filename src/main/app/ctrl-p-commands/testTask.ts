import { Util } from '../util';
import { ScriptFactory } from '../util/script/ScriptFactory';
//@ts-ignore
import { ScriptFile } from '../util/script/ScriptFile';
//import { FileSystem } from "../util/fs/FileSystemFactory";
/**
 * TypeScript compiler worker that compiles the current file using TypeScript's programmatic API.
 * Outputs compiled JavaScript and declaration files to a specified location.
 */
//const fs = FileSystem.getInstance;
export default async function () {
  const activeUri = await Util.getDownstairsFileUri();
  const sf = ScriptFactory.createFile(activeUri);
  console.log("folderUri", sf.folder().path());
  // console.log(sf.pathWithRespectToDraftRoot());
  // const compiler = new ScriptCompiler(sf);
  // await compiler.compile();
}