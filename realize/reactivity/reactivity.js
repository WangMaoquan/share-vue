/** utils */

const hasOwn = Object.hasOwn;

/** baseHandlers */

const baseHandlers = {
  get(target, key, reciver) {
    if (key === '__raw') {
      return target;
    } else if (key === '__is_reactive') {
      return true;
    }
    const res = Reflect.get(target, key, reciver);
    track(target, key);
    return res;
  },
  set(target, key, value, reciver) {
    const result = Reflect.set(target, key, value, reciver);
    trigger(target, key);
    return result;
  },
};

/** reactive */

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

function isReactive(obj) {
  return !!obj['__is_reactive'];
}

function reactive(obj) {
  if (isReactive(obj)) {
    return obj;
  }
  return createReactiveObject(obj);
}

/** effect */

const targetMap = new WeakMap();
let activeEffect;

class ReactiveEffect {
  constructor(fn, scheduler) {
    this.fn = fn;
    this.scheduler = scheduler;
    this.parent = undefined;
  }

  run() {
    try {
      activeEffect = this;
      return this.fn();
    } finally {
      activeEffect = undefined;
    }
  }
}

function effect(fn, options) {
  const _effect = new ReactiveEffect(fn);
  Object.assign(_effect, options);
  return _effect.run();
}

function track(target, key) {
  if (activeEffect) {
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()));
    }
    let deps = depsMap.get(key);
    if (!deps) {
      depsMap.set(key, (deps = new Set()));
    }
    deps.add(activeEffect);
  }
}

function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    return;
  }
  const deps = depsMap.get(key);
  const effects = [...deps];
  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i];
    if (effect !== activeEffect) {
      effect.run();
    }
  }
}

/** test */

function test() {
  const origin = {
    name: 'decade',
    age: 21,
  };
  const state = reactive(origin);
  const state1 = reactive(origin);
  console.log(state === state1);

  effect(() => {
    state.age++;
  });
}

test();
