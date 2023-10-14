import { track, trigger, pauseTracking, enableTracking } from './effect';
import { hasOwn, isArray, isObject } from '../../share/general';
import { isRef } from './ref';
import { toRaw } from './reactive';

function createArrayInstrumentations() {
  const instrumentations = {};
  // 这里注意不能用箭头函数, 不然this 就是 window
  ['push', 'pop', 'splice', 'shift', 'unshift'].forEach(function (key) {
    // 这里同理
    instrumentations[key] = function (...args) {
      pauseTracking();
      // 我们需要的是 target[key] 所以需要 toRaw
      const res = toRaw(this)[key].call(this, ...args);
      enableTracking();
      return res;
    };
  });
  return instrumentations;
}

const arrayInstrumentations = createArrayInstrumentations();

export const baseHandlers = {
  get(target, key, receiver) {
    if (key === '__raw') {
      return target;
    } else if (key === '__is_reactive') {
      return true;
    }
    if (isArray(target) && hasOwn(arrayInstrumentations, key)) {
      return Reflect.get(arrayInstrumentations, key, receiver);
    }
    const res = Reflect.get(target, key, receiver);
    track(target, key);
    if (isRef(res)) {
      return isArray(target) ? res.value : res;
    }
    if (isObject(res)) {
      return reactive(res);
    }
    return res;
  },
  set(target, key, value, receiver) {
    const hadKey = hasOwn(target, key);
    const oldValue = target[key];
    const result = Reflect.set(target, key, value, receiver);
    if (!hadKey) {
      trigger(target, 'add', key);
    } else if (!Object.is(value, oldValue)) {
      trigger(target, 'set', key);
    }
    return result;
  },
  has(target, key) {
    const result = Reflect.has(target, key);
    track(target, 'has', key);
    return result;
  },
  deleteProperty(target, key) {
    const hadKey = hasOwn(target, key);
    const result = Reflect.deleteProperty(target, key);
    if (result && hadKey) {
      trigger(target, 'delete', key);
    }
    return result;
  },
  ownKeys(target) {
    track(target, 'iterator', isArray(target) ? 'length' : 'iterator_key');
    return Reflect.ownKeys(target);
  },
};
