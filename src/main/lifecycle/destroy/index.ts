import { b6p_disposables } from '../../shared';
export function detachCommands() {
  b6p_disposables.forEach(disposable => disposable.dispose());
}