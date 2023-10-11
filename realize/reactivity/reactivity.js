/** utils */

const hasOwn = Object.hasOwn;

const isArray = Array.isArray;

const ObjectToString = (value) => Object.prototype.toString.call(value);

const isObject = (value) => ObjectToString(value) === '[object Object]';

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
    if (isObject(res)) {
      return reactive(res);
    }
    return res;
  },
  set(target, key, value, reciver) {
    const hadKey = hasOwn(target, key);
    const oldValue = target[key];
    const result = Reflect.set(target, key, value, reciver);
    if (!hadKey) {
      trigger(target, 'add', key);
    } else if (Object.is(value, oldValue)) {
      trigger(target, 'set', key);
    }
    return result;
  },
  has(target, key) {
    const result = Reflect.has(target, key);
    rack(target, 'has', key);
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
  // 自己执行
  _effect.run();
  // 通过bind, 返回执行器
  const effectRun = _effect.run.bind(_effect);
  return effectRun;
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

function trigger(target, type, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    return;
  }
  const deps = [];
  if (key !== undefined) {
    deps.push(depsMap.get(key));
  }
  switch (type) {
    case 'add':
      if (isArray(target)) {
        // 数组的添加 会改变 长度
        deps.push(depsMap.get('length'));
      } else {
        // 对象的key 值增加 会影响 遍历
        deps.push(depsMap.get('iterator_key'));
      }
      break;
    case 'delete':
      if (!isArray(target)) {
        deps.push(depsMap.get(ITERATE_KEY));
      }
      break;
    case 'set':
      // todo
      break;
  }
  const flatDep = [];
  for (const dep of deps) {
    if (dep) {
      flatDep.push(...dep);
    }
  }
  tiggerEffects(flatDep);
}

function tiggerEffects(dep) {
  const effects = [...dep];
  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i];
    if (effect !== activeEffect) {
      // 解决循环依赖
      effect.run();
    }
  }
}

/** test */

function testObject() {
  const origin = {
    name: 'decade',
    age: 21,
  };
  const state = reactive(origin);
  const state1 = reactive(origin);
  console.log(state === state1);

  const effectRun = effect(() => {
    console.log(state.age++);
  });

  effectRun();
}

function testArray() {
  const arr = reactive([1, 2, 3]);

  effect(() => {
    console.log(arr.length);
  });

  arr[4] = 1;
}

function nestObject() {
  const state = reactive({
    info: {
      email: 'xxxx@qq.com',
      desc: 'xxxx',
    },
  });

  console.log(isReactive(state.info));
}

nestObject();
