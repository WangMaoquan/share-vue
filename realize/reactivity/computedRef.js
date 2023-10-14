import { triggerRefValue, trackRefValue } from './ref';
import { isFunction } from '../../share/general';

class ComputedRefImpl {
  constructor(getter, setter) {
    this._getter = getter;
    this._setter = setter;
    this.__is_ref = true;
    // 是否需要执行 getter
    this._dirty = true;
    this.effect = new ReactiveEffect(getter, () => {
      this._dirty = true;
      triggerRefValue(this);
    });
  }

  get value() {
    trackRefValue(this);
    if (this._dirty) {
      this._value = this.effect.run();
      this._dirty = false;
    }
    return this._value;
  }
  set value(value) {
    return this._setter(value);
  }
}

export function computed(getterOrOptions) {
  let getter, setter;
  if (isFunction(getterOrOptions)) {
    getter = getterOrOptions;
    setter = (v) => {
      console.log(`can not set value: ${v}`);
    };
  } else {
    getter = getterOrOptions.get;
    setter = getterOrOptions.set;
  }
  return new ComputedRefImpl(getter, setter);
}
