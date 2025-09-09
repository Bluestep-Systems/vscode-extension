/**
 * A pseud-map interface that only allows read operations.
 */
declare interface ReadOnlyMap<T> {
  get(key: string): T | undefined;
  has(key: string): boolean;
  forEach(callback: (value: T, key: string, map: this) => void): void;
}
export type Primitive = string | number | boolean | null | bigint;

/**
 * A nested object where all values are primitives or other nested objects.
 */
export type PrimitiveNestedObject = {
  [key: string]: Primitive | PrimitiveNestedObject
}

/**
 * A savable object can be a primitive, an array of primitives.
 *
 * By design, this should be an object such that it can be serialized to JSON and back without loss of information.
 */
export type SavableObject =
  | Primitive
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
    "D:response": {
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
 * data requisite to manage an individual session
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
 * Basic auth parameters.
 */
export type BasicAuthParams = {
  username: string;
  password: string;
};

/**
 * //TODO
 */
type ScriptGqlResp = ScriptGQLGoodResp | ScriptGQLBadResp;

/**
 * //TODO
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
 * //TODO
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
    downstairsPath: string;
    lastPushed: string | null;
    lastPulled: string | null;
  }[]
}