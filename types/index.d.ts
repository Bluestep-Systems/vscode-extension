/**
 * TODO
 */
declare interface ReadOnlyMap<T> {
  get(key: string): T | undefined;
  has(key: string): boolean;
  forEach(callback: (value: T, key?: string) => void): void;
}

export type SavableObject = string | number | boolean | null | bigint | { [key: string]: SavableObject } | SavableObject[];

export type PrimativeNestedObject<T> = { [key: string]: T | PrimativeNestedObject<T> };

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
export type SimpleNestedObject<T> = PrimativeNestedObject<T | PrimativeNestedObject<T>>;