/**
 * A map-like interface that only allows read operations.
 */
declare interface ReadOnlyMap<T> {
  get(key: string): T | undefined;
  has(key: string): boolean;
  forEach(callback: (value: T, key: string, map: this) => void): void;
}

/**
 * A primitive value that can be serialized.
 */
export type PrimitiveSerializable = string | number | boolean | null;

/**
 * A nested object where all values are primitives or other nested objects.
 * 
 * @example
 * // Valid PrimitiveNestedObject examples:
 * const example1: PrimitiveNestedObject = { k1: "value", k2: 42, k3: true };
 * const example2: PrimitiveNestedObject = { nested: { k1: "value" }, k2: 100 };
 * const example3: PrimitiveNestedObject = { k1: null, k2: { k3: false } };
 */
export type PrimitiveNestedObject = {
  [key: string]: PrimitiveSerializable | PrimitiveNestedObject
}

/**
 * A savable object can be a primitive, an array of primitives.
 *
 * By design, this should be an object such that it can be serialized to JSON and back without loss of information.
 * 
 * I.E. 
 * ```typescript
 * Util.deepEquals(JSON.parse(JSON.stringify(obj)), obj) === true
 * ``` 
 *
 * @example
 * // Valid SavableObject examples:
 * const example2: SavableObject = 42;
 * const example5: SavableObject = [1, "two", false, null];
 * const example6: SavableObject = { k1: "v1", k2: 2, k3: [true, 5], k4: { nestedKey: "something" } };
 */
export type SavableObject =
  | PrimitiveSerializable
  | SavableObject[]
  | { [key: string]: SavableObject };

/**
 * The structure of a WebDAV XML response.
 */
export type XMLResponse = {
  "?xml": {
    "@version"?: string;
    "@encoding"?: string;
  };
  "D:multistatus": {
    "D:response": { //TODO this may not actually return an array every time. Needs more investigation
      "D:href": string;
      "D:propstat": {
        "D:status": string;
        "D:prop": {
          "D:creationdate"?: string;
          "D:displayname"?: string;
          "D:getlastmodified"?: string;
          "D:lockdiscovery"?: unknown;
          "D:resourcetype"?: {
            "D:collection"?: unknown;
          };
          "D:supportedlock"?: {
            "D:lockentry": {
              "D:lockscope": {
                "D:exclusive": string;
              };
              "D:locktype": {
                "D:write": string;
              };
            };
          };
          "D:getcontentlength"?: string;
        };
      };
    }[];
  };
}

/**
 * data requisite to manage an individual login session
 */
export type SessionData = {

  /**
   * timestamp of the last time this session was used
   */
  lastTouched: number;

  /**
   * the JSESSIONID cookie value used by tomcat to identify the session
   */
  JSESSIONID: string | null;

  /**
   * the INGRESSCOOKIE cookie value used by the ingress controller to identify the session
   */
  INGRESSCOOKIE: string | null;

  /**
   * the last CSRF token received from the server
   */
  lastCsrfToken: string | null;
}

/**
 * Basic auth information.
 */
export type BasicAuthParams = {
  username: string;
  password: string;
};

/**
 * GQL response for script queries, either "good" or "bad".
 */
type ScriptGqlResp = ScriptGQLGoodResp | ScriptGQLBadResp;

/**
 * how a GQL response looks when it is "good"
 * 
 * //TODO this is incomplete for every GQL query possible. This should be tied to specific queries
 */
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

/**
 * how a GQL response looks when there were errors with the query
 */
type ScriptGQLBadResp = {
  "errors": [
    {
      "message": string
    }
  ]
}

/**
 * //TODO
 */
type SourceOps = { sourceOrigin: string, topId: string, skipMessage?: true };

/**
 * The metadata for the RemoteScript objects used locally.
 */
type ScriptMetaData = {

  /**
   * The WebDAV ID extracted from the file path.
   */
  webdavId: string;

  /**
   * The name of the script.
   */
  scriptName: string;

  /**
   * push/pull records for the script.
   */
  pushPullRecords: {

    /**
     * actual location of the file locally
     */
    downstairsPath: string;

    /**
     * the time `new Date().toUTCString()` when the last push happened
     */
    lastPushed: string | null;

    /**
     * the time `new Date().toUTCString()` when the last pull happened
     */
    lastPulled: string | null;

    /**
     * the hash of the file when it was last verified (after a push or pull)
     */
    lastVerifiedHash: string;
  }[];

}
/**
 * This is the content of a metadata.json found in every script folder.
 *
 * It is used to store various metadata about the script.
 * 
 * //TODO this is incomplete and is not correct for all Script types
 */
export type MetaDataJsonFileContent = {
  /**
   * //TODO
   */
  displayName: string;
  /**
   * //TODO
   */
  description: string;
  /**
   * //TODO
   */
  _postAncestorId: string;
  /**
   * //TODO
   */
  disabled: boolean;
  /**
   * //TODO
   */
  frozen: boolean;
  /**
   * //TODO
   */
  fixedId: string;
  /**
   * this is a newline separated list of key=value altids
   * @example
   * altIds: "FID=value1\nSID=value2\nGID=value3"
   */
  altIds: string;
  /**
   * //TODO
   */
  path: string;
  /**
   * //TODO
   */
  deniedIPs: string;
  /**
   * //TODO
   */
  allowedIPs: string;
  /**
   * //TODO
   */
  IPFilterExemptGroupKey: string;
  /**
   * //TODO
   */
  IPFilterPermissionOption: "Error";
  /**
   * //TODO
   */
  basicPermissionOption: "Error";
  /**
 * //TODO
 */
  httpOption: "HttpsRedirect" | "HttpsOnly" | "HttpAndHttps";
  /**
   * //TODO
   */
  allowedMethods?: string[];
}

/**
 * propagation behavior options for scripts
 */
type PropagationBehaviorTypes = "MANDATORY" | "NESTED" | "NEVER" | "NOT_SUPPORTED" | "REQUIRED" | "REQUIRES_NEW" | "SUPPORTS";

/**
 * sandbox size options for scripts
 * 
 * see platform documentation for details
 */
type SandboxSizes =
  "XXX_SMALL"
  | "XX_SMALL"
  | "X_SMALL"
  | "SMALL"
  | "MEDIUM_SMALL"
  | "MEDIUM"
  | "MEDIUM_LARGE"
  | "LARGE"
  | "X_LARGE"
  | "XX_LARGE"
  | "XXX_LARGE"
  | "UNLIMITED";

/**
 * This is the content of a config.json found in every script folder.
 */
type ConfigJsonContent = {

  /**
   * the main script file to execute (relative to the script folder)
   * 
   * technically this can be any path but by convention it is always "../scripts/app"
   */
  main: "../scripts/app",

  /**
   * propagation behavior for this script
   */
  propagationBehavior: PropagationBehaviorTypes,

  /**
   * //TODO
   */
  transactionReadonly: boolean,

  /**
   * //TODO
   */
  transactionTimeout: string | number,

  /**
   * sandbox size
   */
  sandbox: SandboxSizes,

  /**
   * //TODO
   */
  expiresBy: string,

  /**
   * "Local external" modules
   */
  models?: {
    name: string,
    url: string
  }[],

  /**
   * //TODO
   */
  language: "mjs",

  /**
   * //TODO
   */
  scriptlibrary: "private"
};

/**
 * Information about a release of the B6P platform.
 */
export type UpdateInfo ={
  version: string;
  downloadUrl: string;
  releaseNotes: string;
  publishedAt: string;
}
export type ClientInfo = {
  version: string;
  lastChecked: number;
  githubToken: string | null;
}
export type GithubRelease = {
  url: string;
  html_url: string;
  assets_url: string;
  upload_url: string;
  tarball_url: string;
  zipball_url: string;
  id: number;
  node_id: string;
  tag_name: string;
  target_commitish: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  immutable: boolean;
  created_at: string;
  published_at: string;
  author: {
    login: string;
    id: number;
    node_id: string;
    avatar_url: string;
    gravatar_id: string;
    url: string;
    html_url: string;
    followers_url: string;
    following_url: string;
    gists_url: string;
    starred_url: string;
    subscriptions_url: string;
    organizations_url: string;
    repos_url: string;
    events_url: string;
    received_events_url: string;
    type: "User";
    site_admin: false;
  };
  assets: [
    {
      url: string;
      browser_download_url: string;
      id: number;
      node_id: string;
      name: string;
      label: string;
      state: "uploaded";
      content_type: "application/zip";
      size: number;
      digest: string;
      download_count: number;
      created_at: string;
      updated_at: string;
      uploader: {
        login: string;
        id: number;
        node_id: string;
        avatar_url: string;
        gravatar_id: string;
        url: string;
        html_url: string;
        followers_url: string;
        following_url: string;
        gists_url: string;
        starred_url: string;
        subscriptions_url: string;
        organizations_url: string;
        repos_url: string;
        events_url: string;
        received_events_url: string;
        type: "User";
        site_admin: false;
      }
    }
  ]
}

/**
 * The settings used by the extension.
 */
export type Settings = {
  /**
   * Whether debug mode is enabled.
   */
  debugMode: {
    /**
     * Whether debug mode is enabled.
     */
    enabled: boolean;
  }
  /**
   * Settings related to update checks.
   */
  updateCheck: {
    /**
     * Whether update checks are enabled.
     */
    enabled: boolean;
    /**
     * Whether to show notifications about updates.
     */
    showNotifications: boolean;
  }
}