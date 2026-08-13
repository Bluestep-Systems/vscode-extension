import type { App } from "../App";

export default function (app: typeof App) {
  app.prompt.info("Clearing Sessions, Auth Managers, and Settings");
  app.clearMap(true);
  app.orgCache.clearCache();
  app.auth.clear();
}
