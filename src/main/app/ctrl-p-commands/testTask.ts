import snapshot from './snapshot';
//import { FileSystem } from "../util/fs/FileSystemFactory";
/**
 * TypeScript compiler worker that compiles the current file using TypeScript's programmatic API.
 * Outputs compiled JavaScript and declaration files to a specified location.
 */
//const fs = FileSystem.getInstance;
export default async function () {
  snapshot();
  // if (false) {console.log(snapshot);}
  //   //TODO remove when done
  //   const activeEditor = await Util.getDownstairsFileUri();
  //   const sf = new RemoteScriptFile({ downstairsUri: activeEditor });
  //   console.log("sf.getScriptRoot().getDraftBuildFolderUri())", sf.getScriptRoot().getDraftBuildFolderUri());
  //   //await fs().delete(sf.getScriptRoot().getDraftBuildFolderUri()).catch(e => {console.error(e);});
  //   vscode.workspace.fs.delete(sf.getScriptRoot().getDraftBuildFolderUri());
  //   console.log("(supposedly) Deleted draft build folder");
}