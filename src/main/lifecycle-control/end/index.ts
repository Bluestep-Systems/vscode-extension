import { b6p_disposables } from '../../app';
export default function () {
  b6p_disposables.forEach(disposable => disposable.dispose());
}