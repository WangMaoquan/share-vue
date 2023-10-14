import { trackEffects, triggerEffects } from './effect';
import { toReactive } from './reactive';

class RefImpl {
  constructor(value) {
    // ref 标志
    this.__is_ref = true;
    // 存放依赖的 dep
    // this.dep = new Set();
    this._rawValue = value;
    this._value = toReactive(value);
  }
  get value() {
    trackRefValue(this);
    return this._value;
  }
  set value(newValue) {
    if (!Object.is(newValue, this._rawValue)) {
      this._rawValue = newValue;
      this._value = toReactive(newValue);
      triggerRefValue(this);
    }
  }
}

export function ref(value) {
  if (isRef(value)) {
    return value;
  }
  return new RefImpl(value);
}

export function isRef(value) {
  return !!value['__is_ref'];
}

export function trackRefValue(ref) {
  if (activeEffect) {
    trackEffects(ref.dep || (ref.dep = new Set()));
  }
}

export function triggerRefValue(ref) {
  triggerEffects(ref.dep);
}
