import type { ScriptContext } from "../../../core/script/ScriptContext";

export default function(ctx: ScriptContext) {
  ctx.prompt.info('Clearing all Sessions');
  ctx.orgCache.clearCache();
}
