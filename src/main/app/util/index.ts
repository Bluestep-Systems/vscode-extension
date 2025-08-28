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
}

