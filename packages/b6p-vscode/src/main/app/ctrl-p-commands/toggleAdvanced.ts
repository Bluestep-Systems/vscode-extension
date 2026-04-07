import type { App } from "../App";

export default function(app: typeof App) {
  app.toggleAdvancedMode();
}
