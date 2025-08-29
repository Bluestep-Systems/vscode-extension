import * as vscode from 'vscode';
import { SessionManager } from "../../services/SessionManager";
import { PrivateKeys, PrivatePersistanceMap } from "../../util/data/PseudoMaps";
import { Alert } from "../../util/ui/Alert";
import push from "./push";
declare function getArgs(): { origins: string[], topId: string };
export default async function (): Promise<void> {
  const curText = vscode.window.activeTextEditor!.document.getText();
  eval(curText);
  if (typeof getArgs !== 'function') {
    Alert.error("getArgs is not a function!");
  }
  const { origins, topId } = getArgs();
  console.log("Quick Deploy triggered");
  origins.forEach(async (origin) => {
    const webDavId = await getScriptWebdavId(origin, topId);
    if (webDavId !== null) {
      push(`${origin}/files/${webDavId}/`);
    } else {
      Alert.error(`Could not find script at ${origin} with topId ${topId}`);
    }
  });
}
async function getScriptWebdavId(origin: string, topId: string): Promise<string | null> {
  const SM = SessionManager.getSingleton();

  const boxy = (topId: string) => `{\"query\":\"query ObjectData($id: String!) {\\n  children(parentId: $id) {\\n    ... on Parent {\\n      children {\\n        items {\\n          id\\n        }\\n      }\\n    }\\n  }\\n}\",\"variables\":{\"id\":\"${topId}\"},\"operationName\":\"ObjectData\"}`;
  /**
   * modified from dom.js
   */
  const csrf = {
    fetch: async (url: string | URL, options: RequestInit, retries = 3): Promise<Response> => {
      const b6pCsrfToken = 'B6P-CSRF-TOKEN'.toLowerCase();
      url = new URL(url);
      const origin = url.origin;
      const tokens = new PrivatePersistanceMap<string>(PrivateKeys.SESSION_TOKENS);

      // Add timeout to options

      try {
        if (!tokens.get(origin)) {
          console.log("Fetching new CSRF token for origin", origin);
          const tokenValue = await SM.fetch(`${origin}/csrf-token`).then(r => r.text());
          console.log("tokenValue", tokenValue);
          tokens.set(origin, tokenValue);
        }

        options = options || {};
        options.headers = options.headers || {};

        (options.headers as Record<string, string>)[b6pCsrfToken] = tokens.get(origin) || (() => { throw new Error("CSRF token not found"); })();

        let response = await SM.fetch(url, options);

        // Clear the timeout since request succeeded

        // TODO: figure out why the get here is always returning empty
        // and why the for loop is needed
        let newToken = response.headers.get(b6pCsrfToken);
        for (const [key, value] of Object.entries(options.headers)) {
          console.log(`Header: ${key}, Value: ${value}`);
          if (key === b6pCsrfToken) {
            newToken = value;
          }
        }
        if (!newToken) {
          throw new Error("No CSRF token in response");
        }
        tokens.set(origin, newToken);
        return response;

      } catch (error) {

        // Handle specific error types
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            throw new Error('Request timed out after 10 seconds');
          }
          if (error.message.includes('terminated') && retries > 0) {
            console.log(`Request terminated, retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            return csrf.fetch(url, options, retries - 1);
          }
        }
        throw error;
      }
    }
  };
  try {
    const GQL_RESP = await csrf.fetch(origin + "/gql", {
      method: "POST",
      headers: {
        "Accept": "*/*",
        "Content-Type": "application/json"
      },
      body: boxy(topId)
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

type ScriptGqlResp = ScriptGQLGoodResp | ScriptGQLBadResp;

type ScriptGQLGoodResp = {
  "data": {
    "children": [
      {
        "children": {
          "items": [
            {
              "id": string
            }
          ]
        }
      }
    ]
  }
};

type ScriptGQLBadResp = {
  "errors": [
    {
      "message": string
    }
  ]
}