import pullScript from "./scripts/pull";
import pullCurrent from "./scripts/pullCurrent";
import pushScript from "./scripts/push";
import pushCurrent from "./scripts/pushCurrent";
import updateCredentials from "./scripts/updateCredentials";
import runTask from "./scripts/runTask";
import checkForUpdates from "./scripts/checkForUpdates";
import notify from "./scripts/notify";
import quickDeploy from "./scripts/quickDeploy";

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
  quickDeploy
};
