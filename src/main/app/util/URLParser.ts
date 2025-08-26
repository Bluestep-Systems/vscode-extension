// Example URL "https://bst3.bluestep.net/files/1433697/draft/";

export class BsjsDavUrl extends URL {
  isReadOnly: boolean;
  webDavId: string;

  constructor(url: string) {
    super(url);

    const parts = this.pathname.split('/');
    if (parts.length < 2) {
      throw new Error(`Invalid URL ${url}, path must be of the form /files/{webDavId}[/...]`);
    }
    this.webDavId = parts[1];

    switch (parts[0]) {
      case "files":
        this.isReadOnly = false;
        break;
      case "public":
        this.isReadOnly = true;
        break;
      default:
        throw new Error(`Invalid URL ${url}, path must start with 'files' or 'public'`);
    }
  }

}