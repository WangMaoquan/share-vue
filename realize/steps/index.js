/** utils */

const hasOwn = Object.hasOwn;

const isArray = Array.isArray;

const ObjectToString = (value) => Object.prototype.toString.call(value);

const isObject = (value) => ObjectToString(value) === '[object Object]';

const isFunction = (value) => typeof value === 'function';

/** reactivity start */

/** baseHandlers */

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

const baseHandlers = {
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

function toReactive(value) {
  return isObject(value) ? reactive(value) : value;
}

function toRaw(value) {
  const raw = value['__raw'];
  return raw ? raw : value;
}

/** ref */

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

function ref(value) {
  if (isRef(value)) {
    return value;
  }
  return new RefImpl(value);
}

function isRef(value) {
  return !!value['__is_ref'];
}

function trackRefValue(ref) {
  if (activeEffect) {
    trackEffects(ref.dep || (ref.dep = new Set()));
  }
}

function triggerRefValue(ref) {
  triggerEffects(ref.dep);
}

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

function computed(getterOrOptions) {
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

/** effect */

const targetMap = new WeakMap();
let activeEffect,
  shouldTrack = true; // 是否应该track 解决 数组改变自身的方法, 不然会导致爆栈

function pauseTracking() {
  shouldTrack = false;
}

function enableTracking() {
  shouldTrack = true;
}

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
  if (activeEffect && shouldTrack) {
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()));
    }
    let deps = depsMap.get(key);
    if (!deps) {
      depsMap.set(key, (deps = new Set()));
    }
    trackEffects(deps);
  }
}

function trackEffects(deps) {
  deps.add(activeEffect);
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
  triggerEffects(flatDep);
}

function triggerEffects(dep) {
  const effects = [...dep];
  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i];
    if (effect !== activeEffect) {
      // 解决循环依赖
      if (effect.scheduler) {
        effect.scheduler();
      } else {
        effect.run();
      }
    }
  }
}

/** reactivity end */

/** runtime-core  start */

/** renderer */
function createRenderer(rendererOptions) {
  const {} = rendererOptions;
  // todo others methods
  function patch(oldVnode, newVnode, container) {
    if (oldVnode === newVnode) {
      return;
    }
    // 下面我们应该根据 vnode 的类型来处理对应的节点, 我们知道 vnode 有 type, 但是不够全, 我们还需要 shapeFlag
    const { type, shapeFlag } = newVnode;
    if (shapeFlag === ShapeFlags.ELEMENT) {
      // todo 处理 element
    } else if (
      [ShapeFlags.STATEFUL_COMPONENT, ShapeFlags.FUNCTIONAL_COMPONENT].includes(
        shapeFlag,
      )
    ) {
      // todo 处理 component
    }
    // 处理 type
  }

  function render(vnode, container) {
    if (vnode) {
      // todo unmounted
    } else {
      patch(null, vnode, container);
    }
  }
  return {
    render,
    createApp: createAppApi(render),
  };
}

/** createAppApi */

let uid = 0;

function createAppApi(render) {
  return function createApp(rootComponent, rootProps) {
    const context = createContext();
    const installedPlugins = new Set();
    let isMounted = false;
    const app = {
      isMounted,
      _uid: uid++,
      _props: rootProps,
      _container: null,
      _context: context,
      _instance: null,

      get config() {
        return context.config;
      },
      set config(v) {
        console.warn('app config cannot set');
      },

      use(plugin, ...options) {
        if (installedPlugins.has(plugin)) {
          console.warn('plugin has been used');
        } else if (plugin && isFunction(plugin.install)) {
          installedPlugins.add(plugin);
          plugin.install(app, ...options);
        } else if (isFunction(plugin)) {
          installedPlugins.add(plugin);
          plugin(app, ...options);
        } else {
          console.warn(
            `A plugin must either be a function or an object with an "install" ` +
              `function.`,
          );
        }
      },

      component(name, component) {
        if (!component) {
          return context.components[name];
        } else {
          context.components[name] = component;
        }
        return app;
      },

      directive(name, directive) {
        if (!directive) {
          return context.diresctive[name];
        } else {
          context.directives[name] = directive;
        }
        return app;
      },

      provide(key, value) {
        context.provides[key] = value;
        return app;
      },

      mount(rootContainer) {
        if (!isMounted) {
          // 创建我们的 根 vnode
          const vnode = createVNode(rootComponent, rootProps);
          // 执行 render
          render(vnode, rootContainer);
          isMounted = true;
          // 用于 umnount
          app._container = rootContainer;
        } else {
          console.warn(`App has already been mounted `);
        }
      },
      unmount() {
        if (isMounted) {
          // 卸载
          render(null, app._container);
        } else {
          console.warn(`Cannot unmount an app that is not mounted.`);
        }
      },
    };
    return app;
  };
}

function createContext() {
  return {
    app: null,
    config: {},
    provides: Object.create(null),
    components: {},
    directives: {},
  };
}

/** h */

function h(type, propsOrChildren, children) {
  const len = arguments.length;
  if (len === 2) {
    if (!isArray(propsOrChildren) && isObject(propsOrChildren)) {
      return createVNode(type, propsOrChildren);
    } else {
      return createVNode(type, null, [propsOrChildren]);
    }
  } else {
    return createVNode(type, propsOrChildren, children);
  }
}

/** vnode */

var ShapeFlags = {
  ELEMENT: 'element',
  STATEFUL_COMPONENT: 'statefulComponent',
  FUNCTIONAL_COMPONENT: 'functionalComponent',
};

function createVNode(type, props, children) {
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT
    : isObject(type)
    ? ShapeFlags.STATEFUL_COMPONENT
    : isFunction(type)
    ? ShapeFlags.FUNCTIONAL_COMPONENT
    : 0;
  return createBaseVNode(type, props, children, shapeFlag);
}

function createBaseVNode(type, props, children, shapeFlag) {
  return {
    __v_isVNode: true,
    __v_skip: true,
    type,
    props,
    children,
    component: null,
    el: null,
    shapeFlag,
  };
}

/** runtime-core  end */
