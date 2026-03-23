import { App } from '../App';
import { Alert } from '../util/ui/Alert';
import audit from './audit';
import pullScript from './pull';

/**
 * Audits the current script for differences against the server, then prompts the user to pull if changes are detected.
 */
export default async function (): Promise<void> {
  const result = await audit();
  if (!result) {
    return;
  }

  if (result.changedFiles.length === 0) {
    return;
  }

  const YES_OPTION = "Sync";
  const NO_OPTION = "Cancel";
  const response = await Alert.prompt(
    `Detected ${result.changedFiles.length} file(s) with differences:\n\n${result.changedFiles.join("\n")}\n\nSync local copy with the server?`,
    [YES_OPTION, NO_OPTION]
  );

  if (response !== YES_OPTION) {
    App.logger.info("User declined audit-pull sync");
    return;
  }

  await pullScript(result.baseUrl);
}
