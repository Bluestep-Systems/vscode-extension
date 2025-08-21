import { UserCredentials } from "../../../../../types";
import { State } from "../StateManager";
import { SavableMap } from "../SavableMap";
import { parse } from "himalaya";
export default new class {
  TREE = new SavableMap();
  startingUrl = new URL("https://bst3.bluestep.net/files/1433697/draft/");
  getLayer(url: URL, creds: UserCredentials) {
    fetch(url, {
      "headers": {
        "accept": "application/json",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "upgrade-insecure-requests": "1",
        "authorization": `${creds.authHeaderValue()}`
      },
      "body": null,
      "method": "GET"
    }).then(response => response.text()).then(async text => {
      const ret = parse(text);
      console.log(JSON.stringify(ret, null, 2));
    });
  }
}();

