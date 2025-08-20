import { b6p_disposables } from '../../shared';
export default function() {
  b6p_disposables.forEach(disposable => disposable.dispose());
}