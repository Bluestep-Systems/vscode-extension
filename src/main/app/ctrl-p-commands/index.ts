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
import snapshot from "./snapshot";
import goToSetup from "./goToSetup";
import audit from "./audit";
import auditPull from "./auditPull";
import report from "./report";
import clearSettings from "./clearSettings";
import clearSessions from "./clearSessions";
import clearAll from "./clearAll";
import browseScriptRoot from "./browseScriptRoot";
import toggleAdvanced from "./toggleAdvanced";
import toggleDebug from "./toggleDebug";
import openSettings from "./openSettings";

/**
 * Namespace for Ctrl+P command related functions.
 */
export default {
  pullScript,
  pushScript,
  pullCurrent,
  pushCurrent,
  audit,
  auditPull,
  updateCredentials,
  runTask,
  checkForUpdates,
  notify,
  quickDeploy,
  testTask,
  snapshot,
  goToSetup,
  report,
  clearSettings,
  clearSessions,
  clearAll,
  browseScriptRoot,
  toggleAdvanced,
  toggleDebug,
  openSettings,
};
