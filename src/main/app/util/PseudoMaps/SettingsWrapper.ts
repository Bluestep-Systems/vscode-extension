import * as vscode from "vscode";
import type { Settings, Serializable } from "../../../../../types";
import { App } from "../../App";
import { Alert } from "../ui/Alert";
import { Util } from "..";
import { TypedMap } from "./TypedMap";
import { Persistable } from "./Persistable";

/**
 * A wrapper around the vscode settings for this extension to provide typed access and modification.
 * 
 * A convention is used where the settings key in vscode is `bsjs-push-pull.<settingKey>`
 * and nested keys are represented with dot notation, e.g. `bsjs-push-pull.nested.key`.
 * 
 * We very specifically want to funnel all active settings changes through this class
 * so that we can ensure that the settings are always in sync with the appropriate context variables
 * that we use for UI responsiveness.
 * 
 * @lastreviewed 2025-10-01
 */
export class SettingsWrapper extends TypedMap<Settings> implements Persistable {
  public static readonly DEFAULT: Settings = {
    debugMode: { enabled: false, anyDomainOverrideUrl: "https://templateassisted.myassn.com/" },
    updateCheck: { enabled: true, showNotifications: true }
  };

  constructor() {
    // Read from user settings (global) with fallback to defaults
    const config = vscode.workspace.getConfiguration().inspect<Settings>(App.appKey)?.globalValue ||
      SettingsWrapper.DEFAULT;
    super(config);
  }

  
  get<K extends keyof Settings>(key: K): Settings[K] {
    let ret = super.get(key) || SettingsWrapper.DEFAULT[key];
    if (Object.keys(ret).length !== Object.keys(SettingsWrapper.DEFAULT[key]).length) {
      ret = { ...SettingsWrapper.DEFAULT[key], ...ret };
    }
    return ret;
  }

  
  set<K extends keyof Settings>(key: K, value: Settings[K]): this {
    super.set(key, value);
    console.log(`Setting context key: bsjs-push-pull.${key} to ${JSON.stringify(value)}`);
    this.store();
    return this;
  }

  /**
   * Stores the current settings to the VSCode configuration.
   * @param update Whether to update the VSCode configuration (default: true). Passing false will only update context variables,
   * because otherwise it would cause an infinite loop when called from sync().
   */
  async store(update: boolean = true) {
    const flattened: { key: string, value: Serializable }[] = [];
    for (const key of this.keys()) {
      Util.rethrow(flattenLayer, { key, obj: this.get(key) });
    }

    function flattenLayer({ key, obj }: { key: string, obj: Serializable }) {
      if (typeof obj === 'object' && obj !== null) {
        for (const [k, v] of Object.entries(obj)) {
          flattenLayer({ key: `${key}.${k}`, obj: v });
        }
      } else {
        flattened.push({ key, value: obj });
      }
    }

    flattened.forEach(({ key, value }) => {
      const config = vscode.workspace.getConfiguration(App.appKey);

      // Set context variable for immediate UI responsiveness
      vscode.commands.executeCommand('setContext', `bsjs-push-pull.${key}`, value);

      if (update) {
        try {
          config.update(key, value, vscode.ConfigurationTarget.Global);
        } catch (e) {
          Alert.error(`Error updating settings key ${key}: ${e}`);
          throw e;
        }
      }
    });
  }

  /**
   * Synchronizes the in-memory settings with the actual VSCode settings.
   * This reads the current settings from VSCode and updates the internal state accordingly.
   * It also removes any obsolete settings that are no longer present in the VSCode configuration.
   * 
   * @lastreviewed 2025-10-01
   */
  sync(): void {
    // Read the effective configuration value (includes recent updates)
    const inspectResult = vscode.workspace.getConfiguration().inspect<Settings>(App.appKey);
    const config = inspectResult?.globalValue || SettingsWrapper.DEFAULT;
    // Merge with defaults to ensure all keys are present
    // It appears VScode likes to drop keys that are set to undefined or false for some reason
    const fleshedOut = { ...SettingsWrapper.DEFAULT, ...config };

    // Update each property individually to maintain type safety
    for (const key of Object.keys(fleshedOut)) {
      const k = key as keyof Settings;
      const value = fleshedOut[k];
      type K = keyof Settings;
      // Use the set method without store() call to avoid redundant updates
      (this.obj as Record<K, Settings[K]>)[k] = value as Settings[K];
    }

    for (const key of this.keys()) {
      if (!(key in fleshedOut)) {
        console.log(`Removing obsolete setting ${key}`);
        this.delete(key);
      }
    }

    this.store(false);
  }
}