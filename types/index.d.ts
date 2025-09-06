/**
 * TODO
 */
declare interface ReadOnlyMap<T> {
  get(key: string): T | undefined;
  has(key: string): boolean;
  forEach(callback: (value: T, key?: string) => void): void;
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
 * By design, this should be an object such that `JSON.stringify(obj) === JSON.stringify(JSON.parse(JSON.stringify(obj)))` is true
 */
export type SavableObject =
  | Primitive
  | Primitive[]
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
  lastTouched: number;
  JSESSIONID: string | null;
  INGRESSCOOKIE: string | null;
  lastCsrfToken: string | null;
  fresh: boolean;
}
/**
 * Basic auth parameters.
 */
export type BasicAuthParams = {
  username: string;
  password: string;
};

/**
 * TODO
 */
type ScriptGqlResp = ScriptGQLGoodResp | ScriptGQLBadResp;

/**
 * TODO
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
 * TODO
 */
type ScriptGQLBadResp = {
  "errors": [
    {
      "message": string
    }
  ]
}

/**
 * TODO
 */
type SourceOps = { sourceOrigin: string, topId: string, skipMessage?: true };