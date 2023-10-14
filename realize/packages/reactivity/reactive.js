const reactiveMap = new WeakMap();

function createReactiveObject(obj) {
  const targetProxy = reactiveMap.get(obj);
  if (targetProxy) {
    return targetProxy;
  }
  const proxy = new Proxy(obj, baseHandlers);
  reactiveMap.set(obj, proxy);
  return proxy;
}

export function isReactive(obj) {
  return !!obj['__is_reactive'];
}

export function reactive(obj) {
  if (isReactive(obj)) {
    return obj;
  }
  return createReactiveObject(obj);
}

export function toReactive(value) {
  return isObject(value) ? reactive(value) : value;
}

export function toRaw(value) {
  const raw = value['__raw'];
  return raw ? raw : value;
}
