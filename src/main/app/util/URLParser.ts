export function urlParser(str: string) {
  //const str = "https://bst3.bluestep.net/files/1433697/draft/";
  const url = new URL(str);
  const match = url.pathname.match(/\/(files|public)\/(\d+)\/(.*)/);
  const type = match && match[1] || (() => { throw new Error("no type"); })(); // type is match[1], which is the first capture group (files|public)
  const webDavId = match && match[2] || (() => { throw new Error("no webDavId"); })(); // webDavId is match[2], which is the second capture group (\d+); for the example URL, this will be "1433697"
  const trailing = match && match[3];
  return { url, type, webDavId, trailing } as { url: URL; type: "files" | "public"; webDavId: string; trailing: string | undefined };
}