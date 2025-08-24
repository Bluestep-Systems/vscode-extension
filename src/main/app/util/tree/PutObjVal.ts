import { PrimitiveNestedObject } from "../../../../../types";

/** Adds a value to the object at the defined path */
export default function(obj: PrimitiveNestedObject, path: string[], val: any, className: string) {
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
    } else if  (typeof iteratedObj[location] === className) {
      iteratedObj[location] = { [`${iteratedObj[location]}`]: iteratedObj[location] };
    }
    iteratedObj = iteratedObj[location] as PrimitiveNestedObject;
  } while (path.length > 1);
  iteratedObj[path[0]] = val;
}