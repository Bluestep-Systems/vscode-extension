export namespace Util {
  export function printLine(ops?: { ret?: boolean }) {
    const stack = new Error().stack || (() => { throw new Error("no stack"); })();
    const line = stack.split('\n')[2]; // 0:Error, 1:this function, 2:caller
    if (ops?.ret) {
      return line;
    }
    console.log(line);
    return;
  }
}

