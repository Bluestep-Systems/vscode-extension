import type { ScriptContext } from '@bluestep-systems/b6p-core';

export default function(ctx: ScriptContext) {
  ctx.prompt.info('Clearing all Sessions');
  ctx.orgCache.clearCache();
}
