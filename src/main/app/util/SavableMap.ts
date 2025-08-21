import { SavableObject } from "../../../../types";
import { isPrimitive } from ".";
export class SavableMap<T extends (SavableObject | SavableObject[] | SavableMap<T>)> extends Map<string, T> {
  constructor(savableObj?: SavableObject) {
    if (savableObj === undefined) {
      super();
    } else {
      const constructedM = new SavableMap<T>();
      for (const [key, value] of Object.entries(savableObj as object)) {
        if (isPrimitive(value)) {
          constructedM.set(key, value);
        } else if (Array.isArray(value)) {
          const nextM = new SavableMap();
          for (let i = 0; i < value.length/2; i++) {
            nextM.set(value[i*2], value[i*2+1]);
          }
          constructedM.set(key, nextM as unknown as T);
        } else if (value instanceof Object && "___wasMap" in value) {
          delete value["___wasMap"];
          const subMap = new SavableMap(Object.entries(value));
          constructedM.set(key, subMap as T);
        } else if (value instanceof Object && "___wasArray" in value) {
          delete value["___wasArray"];
          const array = Object.values(value) as SavableObject[];
          constructedM.set(key, array as T);
        } else {
          constructedM.set(key, new SavableMap(Object.entries(value)) as unknown as T);
        }
      }
      return constructedM;
    }
  }
  #arrayToObj(array: SavableObject[]): SavableObject {
    const obj: Record<string, SavableObject> = {};
    for (const [index, value] of array.entries()) {
      if (isPrimitive(value)) {
        obj[index] = value;
      } else if (Array.isArray(value)) {
        obj[index] = this.#arrayToObj(value);
      } else if (value instanceof SavableMap) {
        obj[index] = this.#mapToObj(value);
      } else {
        throw new Error("Unsupported value type in array");
      }
    }
    obj["___wasArray"] = true;
    return obj;
  }
  #mapToObj(map: SavableMap<T>): SavableObject {
    const obj = Object.fromEntries(map);
    for (const [key, value] of Object.entries(obj)) {
      if (value instanceof SavableMap) {
        const mappedObj = this.#mapToObj(value) as Record<string, SavableObject>;
        mappedObj["___wasMap"] = true;
        obj[key] = mappedObj as T;
      } else if (Array.isArray(value)) {
        obj[key] = this.#arrayToObj(value) as T;
      }
    }
    return obj as SavableObject;
  }
  toSavableObject(): SavableObject {
    return this.#mapToObj(this);
  }
  toJSON(): string {
    return JSON.stringify(this.toSavableObject());
  }
  toPrettyString(): string {
    return JSON.stringify(this.toSavableObject(), null, 2);
  }
}