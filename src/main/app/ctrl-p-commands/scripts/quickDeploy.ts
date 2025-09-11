import * as vscode from 'vscode';
import { SESSION_MANAGER as SM} from "../../b6p_session/SessionManager";
import { Alert } from "../../util/ui/Alert";
import { ProgressHelper } from "../../util/ui/ProgressHelper";
import type { ScriptGQLBadResp, ScriptGQLGoodResp, ScriptGqlResp } from "../../../../../types";
import push from "./push";

/**
 * Pushes the current file to multiple origins and topIds as specified by a function in the current file.
 */
export default async function (): Promise<void> {
  const activeTextEditor = vscode.window.activeTextEditor;
  if (activeTextEditor === undefined) {
    Alert.error("No active text editor found");
    return;
  }
  const curText = activeTextEditor.document.getText();
  //NOTE: we may assume that this eval is safe, as the user is in control of the contents of the file
  const getArgs = eval(curText) as (() => { recipientOrgs: string[], topIds: string[], sourceOrigin: string });

  if (typeof getArgs !== 'function') {
    Alert.error("getArgs is not a function!");
    return;
  }
  const { recipientOrgs, topIds, sourceOrigin } = getArgs();
  console.log("Quick Deploy triggered");
  const origins = recipientOrgs.map(v => new URL(v).origin);

  // Create tasks for all origin/topId combinations
  const deployTasks = [];
  for (const origin of origins) {
    for (const topId of topIds) {
      deployTasks.push({
        execute: async () => {
          const webDavId = await getScriptWebdavId(origin, topId);
          if (webDavId !== null) {
            await push(`${origin}/files/${webDavId}/`, { sourceOrigin, topId, skipMessage: true });
            return { origin, topId, webDavId };
          } else {
            await Alert.error(`Could not find script at ${origin} with topId ${topId}`);
            throw new Error(`Could not find script at ${origin} with topId ${topId}`);
          }
        },
        description: `${origin} - ${topId}`
      });
    }
  }

  await ProgressHelper.withProgress(deployTasks, {
    title: "Doing Quick Deploy...",
    showItemCount: true
  });


  Alert.info("Quick Deploy complete!");
}

/**
 * Gets the WebDAV ID of a script.
 * @param origin The origin of the script.
 * @param topId The top ID of the script.
 * @returns The WebDAV ID of the script, or null if not found.
 */
async function getScriptWebdavId(origin: string, topId: string): Promise<string | null> {
  const originUrl = new URL(origin);
  const gqlBody = (topId: string) => `{\"query\":\"query ObjectData($id: String!) {\\n  children(parentId: $id) {\\n    ... on Parent {\\n      children {\\n        items {\\n          id\\n        }\\n      }\\n    }\\n  }\\n}\",\"variables\":{\"id\":\"${topId}\"},\"operationName\":\"ObjectData\"}`;

  try {
    const GQL_RESP = await SM.csrfFetch(originUrl.origin + "/gql", {
      method: "POST",
      headers: {
        "Accept": "*/*",
        "Content-Type": "application/json"
      },
      body: gqlBody(topId)
    }).then((res: Response) => res.json()).catch(e => {
      throw new Error(`[[Error]] fetching GraphQL data: ${e}`);
    }) as ScriptGqlResp;
    if ((GQL_RESP as ScriptGQLBadResp).errors) {
      Alert.error("GraphQL errors found");
      throw new Error("GraphQL errors found: " + JSON.stringify((GQL_RESP as ScriptGQLBadResp).errors));
    }
    const targetScriptRootFolderId = (GQL_RESP as ScriptGQLGoodResp).data.children[0]?.children.items[0]?.id;
    if (!targetScriptRootFolderId) {
      Alert.error(`No script root folder found for topId: ${topId}`);
      throw new Error(`No script root folder found for topId: ${topId}`);
    }
    try {
      const targetScriptWebdavId = new WebDavId(targetScriptRootFolderId).seqnum;
      return targetScriptWebdavId;
    } catch (e) {
      throw new WebdavParsingError(`Error parsing WebDAV ID from: ${targetScriptRootFolderId}`);
    }
  } catch (e) {
    if (e instanceof WebdavParsingError) {
      return null;
    } else if (e instanceof Error) {
      Alert.error(e.stack || e.message || String(e));
    } else {
      Alert.error(String(e));
    }
    throw new Error(`Error fetching script WebDAV ID from ${origin} for topId ${topId}`);
  }
}

class WebDavId {
  classid: string;
  seqnum: string;
  constructor(id: string) { 
    // take an id of this format "530003___1082638" and parse it into classid and seqnum using regex
    const match = id.match(/^(\d+)___(\d+)$/);
    if (!match) {
      throw new WebdavParsingError(`Invalid WebDAV ID format: ${id}`);
    }
    this.classid = match[1];
    this.seqnum = match[2];
  }
}

class WebdavParsingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebdavParsingError';
  }
}