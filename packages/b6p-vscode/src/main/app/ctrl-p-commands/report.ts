import type { ScriptContext } from '@bluestep-systems/b6p-core';

export default async function(ctx: ScriptContext) {
  const entries = ctx.scriptMetadataStore.all();
  const summary = entries.length === 0
    ? 'No script metadata entries stored.'
    : entries.map(e => `${e.U}/${e.scriptName} (webdavId: ${e.webdavId}, records: ${e.pushPullRecords.length}, classid: ${e.scriptKey.classid}, seqnum: ${e.scriptKey.seqnum})`).join('\n');
  ctx.logger.info('=== Script Metadata Store ===\n' + summary);

  const orgEntries = [...ctx.orgCache.map()];
  const orgSummary = orgEntries.length === 0
    ? 'No org cache entries.'
    : orgEntries.map(([u, elements]) => `${u}: ${elements.map(e => `${e.host} (lastAccess: ${new Date(e.lastAccess).toISOString()})`).join(', ')}`).join('\n');
  ctx.logger.info('=== Org Cache ===\n' + orgSummary);

  ctx.prompt.info(`${entries.length} metadata ${entries.length === 1 ? 'entry' : 'entries'}, ${orgEntries.length} org cache ${orgEntries.length === 1 ? 'entry' : 'entries'} stored. See output channel for details.`);
}
