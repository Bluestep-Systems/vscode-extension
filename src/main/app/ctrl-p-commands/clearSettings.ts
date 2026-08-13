import type { App } from "../App";

export default function (app: typeof App) {
  app.prompt.info("Reverting to default settings");
  app.clearMap();
}
