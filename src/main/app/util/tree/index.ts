import { Serializable } from "node:child_process";
import { parse } from "himalaya";
export default new class {
  TREE: Serializable = {
  };
  startingUrl = new URL("https://bst3.bluestep.net/files/1433697/draft/");
  getLayer() {
    fetch("https://bst3.bluestep.net/files/1433697/draft/", {
      "headers": {
        "accept": "application/json",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "upgrade-insecure-requests": "1",
      },
      "body": null,
      "method": "GET"
    });
  }


}();

