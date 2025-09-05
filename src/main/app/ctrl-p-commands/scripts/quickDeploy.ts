import * as vscode from 'vscode';
import { SESSION_MANAGER } from "../../b6p_session/SessionManager";
import { Alert } from "../../util/ui/Alert";
import type { ScriptGQLBadResp, ScriptGQLGoodResp, ScriptGqlResp } from "../../../../../types";
import push from "./push";

/**
 * Pushes the current file to multiple origins and topIds as specified by a function in the current file.
 */
export default async function (): Promise<void> {
  const curText = vscode.window.activeTextEditor!.document.getText();
  const getArgs = eval(curText) as (() => { origins: string[], topIds: string[], sourceOrigin: string });

  if (typeof getArgs !== 'function') {
    console.log(curText);
    console.log("type", typeof getArgs);
    Alert.error("getArgs is not a function!");
  }
  const { origins, topIds, sourceOrigin } = getArgs();
  console.log("Quick Deploy triggered");
  origins.forEach(async (origin) => {
    topIds.forEach(async topId => {
      const webDavId = await getScriptWebdavId(origin, topId);
      if (webDavId !== null) {
        push(`${origin}/files/${webDavId}/`, { sourceOrigin, topId });
      } else {
        Alert.error(`Could not find script at ${origin} with topId ${topId}`);
      }
    });
  });
}

/**
 * Gets the WebDAV ID of a script.
 * @param origin The origin of the script.
 * @param topId The top ID of the script.
 * @returns The WebDAV ID of the script, or null if not found.
 */
async function getScriptWebdavId(origin: string, topId: string): Promise<string | null> {
  const SM = SESSION_MANAGER;

  const gqlBody = (topId: string) => `{\"query\":\"query ObjectData($id: String!) {\\n  children(parentId: $id) {\\n    ... on Parent {\\n      children {\\n        items {\\n          id\\n        }\\n      }\\n    }\\n  }\\n}\",\"variables\":{\"id\":\"${topId}\"},\"operationName\":\"ObjectData\"}`;
  /**
   * modified from dom.js
   */

  try {
    const GQL_RESP = await SM.csrfFetch(origin + "/gql", {
      method: "POST",
      headers: {
        "Accept": "*/*",
        "Content-Type": "application/json"
      },
      body: gqlBody(topId)
    }).then((res: Response) => res.json()) as ScriptGqlResp;
    if ((GQL_RESP as ScriptGQLBadResp).errors) {
      console.error("GraphQL errors found:", GQL_RESP);
      Alert.error("GraphQL errors found");
      return null;
    }
    const ScriptRootFolderId = (GQL_RESP as ScriptGQLGoodResp).data.children[0]?.children.items[0]?.id;
    const shortId = ScriptRootFolderId.substring(ScriptRootFolderId.lastIndexOf("_") + 1);
    console.log("GQL_RESP", ScriptRootFolderId);
    return shortId;
  } catch (e) {
    console.trace(e instanceof Error ? e.stack ? e.stack : e.message : String(e));
    Alert.error(e instanceof Error ? e.stack ? e.stack : e.message : String(e));
  }
  return null;
}

