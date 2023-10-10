const reactiveMap = new WeakMap();

const baseHandlers = {
  get(target, key, reciver) {
    if (key === '__raw') {
      return target;
    } else if (key === '__is_reactive') {
      return true;
    }
    // todo track
    return Reflect.get(target, key, reciver);
  },
  set(target, key, value, reciver) {
    // todo trigger
    return Reflect.set(target, key, value, reciver);
  },
};

function createReactiveObject(obj) {
  const targetProxy = reactiveMap.get(obj);
  if (targetProxy) {
    return targetProxy;
  }
  const proxy = new Proxy(obj, baseHandlers);
  reactiveMap.set(obj, proxy);
  return proxy;
}

function isReactive(obj) {
  return !!obj['__is_reactive'];
}

function reactive(obj) {
  if (isReactive(obj)) {
    return obj;
  }
  return createReactiveObject(obj);
}
