import { Util } from '../util';
import { ScriptFactory } from '../util/script/ScriptFactory';

export default async function () {
  const activeUri = await Util.getDownstairsFileUri();
  const node = ScriptFactory.createNode(() => activeUri);
  node.copyToSnapshot();
}