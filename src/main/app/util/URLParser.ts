export function urlParser(str: string) {
  //const str = "https://bst3.bluestep.net/files/1433697/draft/";
  const url = new URL(str);
  const match = url.pathname.match(/files\/(\d+)\/(.*)/);
  const webDavId = match && match[1] || (() => { throw new Error("no webDavId"); })(); // id will be "1433697"
  const trailing = match && match[2];
  return { url, webDavId, trailing };
}