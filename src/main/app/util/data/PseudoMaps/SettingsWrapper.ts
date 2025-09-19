import * as vscode from "vscode";
import type { Settings, SavableObject } from "../../../../../../types";
import { App } from "../../../App";
import { Alert } from "../../ui/Alert";
import { Util } from "../..";
import { TypedMap } from "./TypedMap";
import { SoftPersistable } from "./Persistable";

/**
 * A wrapper around the vscode settings to provide typed access and modification.
 * 
 * A convention is used where the settings key in vscode is `bsjs-push-pull.<settingKey>`
 * and nested keys are represented with dot notation, e.g. `bsjs-push-pull.nested.key`.
 * 
 * We very specifically want to funnel all settings changes through this class
 * so that we can ensure that the settings are always in sync with the vscode and appropriate context variables.
 * 
 * The thing to note here is that c
 * 
 * @lastreviewed null
 */
export class SettingsWrapper extends TypedMap<Settings> implements SoftPersistable {
  public static readonly DEFAULT: Settings = { 
    debugMode: { enabled: false }, 
    updateCheck: { enabled: true, showNotifications: true } 
  };
  
  constructor() {
    // Read from user settings (global) with fallback to defaults
    const config = vscode.workspace.getConfiguration().inspect<Settings>(App.appKey)?.globalValue ||
      SettingsWrapper.DEFAULT;
    super(config);
  }

  // documented in parent
  get<K extends keyof Settings>(key: K): Settings[K] {
    return super.get(key) || SettingsWrapper.DEFAULT[key];
  }

  // documented in parent
  set<K extends keyof Settings>(key: K, value: Settings[K]): this {
    super.set(key, value);
    console.log(`Setting context key: bsjs-push-pull.${key} to ${JSON.stringify(value)}`);
    this.store();
    return this;
  }

  // documented in parent
  store(update: boolean = true) {
    console.log('attempting to store');
    const flattened: { key: string, value: SavableObject }[] = [];
    for (const key of this.keys()) {
      Util.rethrow(flattenLayer, { key, obj: this.get(key) });
    }
    
    function flattenLayer({ key, obj }: { key: string, obj: SavableObject }) {
      if (typeof obj === 'object' && obj !== null) {
        for (const [k, v] of Object.entries(obj)) {
          flattenLayer({ key: `${key}.${k}`, obj: v });
        }
      } else {
        flattened.push({ key, value: obj });
      }
    }
    
    console.log("Storing settings:", flattened);
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

  sync(): void {
    // Read the effective configuration value (includes recent updates)
    const inspectResult = vscode.workspace.getConfiguration().inspect<Settings>(App.appKey);
    const config = inspectResult?.globalValue || SettingsWrapper.DEFAULT;
    const fleshedOut = { ...SettingsWrapper.DEFAULT, ...config };
    
    // Update each property individually to maintain type safety
    for (const key of Object.keys(fleshedOut)) {
      const k = key as keyof Settings;
      console.log(`Syncing setting ${k}`);
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