import pullScript from "./pull";
import pullCurrent from "./pullCurrent";
import pushScript from "./push";
import pushCurrent from "./pushCurrent";
import updateCredentials from "./updateCredentials";
import runTask from "./runTask";
import checkForUpdates from "./checkForUpdates";
import notify from "./notify";
import quickDeploy from "./quickDeploy";
import testTask from "./testTask";

/**
 * Namespace for Ctrl+P command related functions.
 */
export default {
  pullScript,
  pushScript,
  pullCurrent,
  pushCurrent,
  updateCredentials,
  runTask,
  checkForUpdates,
  notify,
  quickDeploy,
  testTask
};
