import { PrimitiveNestedObject, SavableObject } from "../../../../types";
/**
 * Utility functions and types.
 */
export namespace Util {
  export function printLine(ops?: { ret?: boolean }) {
    const stack = new Error().stack || (() => { throw new Error("no stack"); })();
    let FULL_LINE = stack.split('\n')[2]!.trim(); // 0:Error, 1:this function, 2:

    const match = FULL_LINE.match(/\(([^)]+)\)/);
    const extracted = match && match[1] || (() => { throw new Error("no extracted value"); })();
    if (ops?.ret) {
      return extracted;
    }
    console.log("LINE:", extracted);
    return;
  }

  /**
   * performs a deep comparison between two savable objects to determine if they are equivalent.
   * @returns 
   */
  export function isDeepEqual(object1: SavableObject, object2: SavableObject): boolean {
    // Handle primitive values (including null)
    if (object1 === object2) {
      return true;
    }

    // If one is null/undefined and the other isn't
    /* eslint-disable eqeqeq */
    if (object1 == null || object2 == null) {
      return false;
    }

    // Handle arrays
    if (Array.isArray(object1) && Array.isArray(object2)) {
      if (object1.length !== object2.length) {
        return false;
      }
      return object1.every((item, index) => isDeepEqual(item, object2[index]));
    }

    // If one is array and other isn't
    if (Array.isArray(object1) || Array.isArray(object2)) {
      return false;
    }

    // Handle objects
    if (isNonPrimitiveSavable(object1) && isNonPrimitiveSavable(object2)) {
      const objKeys1 = Object.keys(object1);
      const objKeys2 = Object.keys(object2);

      if (objKeys1.length !== objKeys2.length) {
        return false;
      }

      for (const key of objKeys1) {
        const value1 = object1[key];
        const value2 = object2[key];

        if (!isDeepEqual(value1, value2)) {
          return false;
        }
      }
      return true;
    }

    // Different types (one object, one primitive)
    return false;
  };

  export function isNonPrimitiveSavable(object: SavableObject): object is { [key: string]: SavableObject } {
    // lack of strict equality check is intentional
    /* eslint-disable eqeqeq */
    return object != null && typeof object === "object" && !Array.isArray(object);
  };


  /** 
   * Adds a value to the object at the defined path 
   * 
   * Modified from BST methodology
   */
  export function PutObjVal(obj: PrimitiveNestedObject, path: string[], val: PrimitiveNestedObject, className: string) {
    let iteratedObj = obj;
    if (path.length === 1) {
      iteratedObj[path[0]] = val;
      return;
    }
    do {
      const location = path.shift();
      if (location === undefined) {
        return;
      };
      if (iteratedObj[location] === undefined) {
        iteratedObj[location] = {};
      } else if (typeof iteratedObj[location] === className) {
        iteratedObj[location] = { [`${iteratedObj[location]}`]: iteratedObj[location] };
      }
      iteratedObj = iteratedObj[location] as PrimitiveNestedObject;
    } while (path.length > 1);
    iteratedObj[path[0]] = val;
  }

  /**
   * inserts a delay for a defined number of milliseconds.
   * @param ms 
   * @returns 
   */
  export async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

