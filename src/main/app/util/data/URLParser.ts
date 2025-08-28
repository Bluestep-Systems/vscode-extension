export function urlParser(str: string): {
  url: URL;
  type: "files" | "public";
  webDavId: string;
  trailing?: string;
} {
  if (!str && !str.trim()) {
    throw new Error("URL string cannot be empty");
  }
  str = str.trim();

  let url: URL;
  try {
    url = new URL(str);
  } catch (error) {
    throw new Error(`Invalid URL format: ${str}`);
  }

  const match = url.pathname.match(/^\/(files|public)\/(\d+)(?:\/(.*))?$/);
  if (!match) {
    throw new Error(`URL does not match expected BlueStep format: ${str}`);
  }

  const [, type, webDavId, trailing] = match;

  return {
    url,
    type: type as "files" | "public",
    webDavId,
    trailing: trailing || undefined
  };
}