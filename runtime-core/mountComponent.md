# processComponent

处理 `sharpFlags` 为 `component` 的 `vnode`

```typescript
const processComponent = (n1, n2, container, anchor /** */) => {
  if (n1 == null) {
    // mountComponent
  } else {
    // updateComponent
  }
};
```

## mountComponent

组件我们需要先转换成 `vnode` 再变成真实 `DOM`, 这里我暂时不提 `template模板` 我们使用 `setup` 返回一个 `render` 方法, 或者使用 `optionsApi` 的 `render` 属性, 大致的思路其实就是创建 `组件instance`, 然后为 `instance.render` 赋值, 最后调用, 拿到组件的`vnode`, 然后进行 `patch`, 大概思路应该是这样的, 下面我们进入 `mountComponent`

```typescript
const mountComponent = (initialVNode, contaier, anchor /** */) => {
  // 生成 instance
  const instance = (initialVNode.component = createComponentInstance(
    initialVNode,
    parent,
  ));

  // setupComponent
  //  compositionApi 取出 setup, optionsApi 取出 render
  const { setup, render: optionRender } = instance.type;

  // finishedComponent
  instance.render = setup() || render;

  // setupRenderEffect
  const componentUpdateFn = () => {
    if (!instance.isMounted) {
      // mount
      const subTree = (instance.subTree = instance.render());

      patch(null, subTree, contaier, anchor);
    } else {
      //  update
      const nextTree = instance.render();
      const prevTree = instance.subTree;
      instance.subTree = nextTree;
      patch(prevTree, nextTree, contaier, anchor);
      instance.isMounted = true;
    }
  };
  const effect = (instance.effect = new ReactiveEffect(componentUpdateFn));

  const update = (instance.update = () => effect.run());

  update();
};
```

简单实现的思路就是上面的代码, 当然后还省略很多处理的细节, 我们的关注点其实是 `componentUpdateFn`, 这是组件的 `挂载/更新` 方法, 因为需要被收集依赖 所以用到了 `ReactiveEffect`

另外细节的方法, 我后面会列出来, 下面我们看看组件实例上都有啥

### createComponentInstance

我们常用的几个 `instance` 上的属性或者方法

- `parent`: 访问父级 `vnode`
- `render`: 组件变成 `vnode` 的方法
- `components`: 保存子组件
- `directives`: 保存自定义的指令
- `emit`: emit 方法
- `props/data`: 状态
- `isMounted`: 是否挂载
- `isUnmounted`: 是否卸载
- `isDeactivated`: 是否失活
- `bc/c/bm/m/bu/u/bum/da/a`: 生命周期

```typescript
let uid = 0;
export function createComponentInstance(vnode, parent) {
  const type = vnode.type; // 对于 element 来说就是 tagName, 对于 component 来说就是 defineCompont 返回的对象
  // 继承parent appContext
  // 根组件的instance是不存在 parent 的 所以需要 vnode.appContext
  const appContext =
    (parent ? parent.appContext : vnode.appContext) || emptyAppContext;
  const instance = {
    uid: uid++,
    vnode,
    type,
    parent,
    appContext,
    root,
    subTree,
    effect,
    update,
    render,
    provides: parent ? parent.provides : Object.create(appContext.provides),
    components: null,
    directives: null,
    propsOptions: normalizePropsOptions(type, appContext),
    emitsOptions: normalizeEmitsOptions(type, appContext),
    emit: null,
    ctx: {},
    data: {},
    props: {},
    slots: {},
    setupState: {},
    setupContext: {}
    isMounted: false,
    isUnmounted: false,
    isDeactivated: false,
    bc: null,
    c: null,
    bm: null,
    m: null,
    bu: null,
    u: null,
    bum: null,
    um: null,
    da: null,
    a: null,
  };
  instance.ctx = createDevRenderContext(instance);
  instance.root = parent ? parent.root : instance;
  instance.emit = emit.bind(null, instance);
  return instance;
}
```

看了 `instance` 上的一部分属性, 我们大概也可以知道我们常用的几个 `api` 大致是怎么去工作的了, 比如 `onMounted` 这样的方法, 最后肯定是将我们的回调 传入到 `instance.m` 对应的 属性里面保存, 最后在对应的时机去读取然后执行

后面我会简单说下 `normalizePropsOptions/normalizeEmitsOptions`, 针对的是 `props/emit` 主要做的肯定是统一化

是不是还有疑问? 在 `2.x` 中访问 `this.$props` 怎么没看见 `$data` 这样的 `属性名` 呢? 其实实现很简单, 我们实际访问的应该是 `instance.data`, 怎么让访问 `$data` 到 `data` 呢? `defineProperty` 也就是 `createDevRenderContext` 这个方法

```typescript
function createDevRenderContext(instance) {
  const target = {};
  Object.defineProperty(target, '_', {
    configurable: true,
    enumerable: false,
    get: () => instance,
  });
  Object.keys(publicPropertiesMap).forEach((key) => {
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: false,
      get: () => publicPropertiesMap[key](instance),
      set: NOOP,
    });
  });
  return target;
}
```

很明显 `publicPropertiesMap` 就是方法 `$data` 那些属性

```typescript
const publicPropertiesMap = extend(Object.create(null), {
  $: (i) => i,
  $el: (i) => i.vnode.el,
  $data: (i) => i.data,
  $attrs: (i) => i.attrs,
  $slots: (i) => i.slots,
  $parent: (i) => i.parnet,
  $emit: (i) => i.emit,
});
```

### setupComponent

生成组件的 `instance` 后, 就需要开始处理 `props, attrs, slots` 这些了, 也就是 `setupComponent`

```typescript
function setupComponent(instance) {
  const { props, children } = instance.vnode;
  initProps(instance, props);
  initSlots(instance, children);
  return instance.vnode.shapeFlag & SharpFlags.STATEFUL_COMPONENT
    ? setupStatefulComponent(instance)
    : undefined;
}
```

主要做的就是

1. 初始化 `props/slots`
2. 是状态的组件的需要执行 `setupStatefulComponent`

其实我们也可以理解到因为 `state` 还没有处理, 可以理解为就是执行 `setup` 方法

### setupStatefulComponent

```typescript
function setupStatefulComponent(instance) {
  const Component = instance.type;
  const { setup } = Component;
  // accessCache 读取缓存
  instance.accessCache = Object.create(null);
  // 可以理解为 2.x 中的 this
  instance.proxy = markRaw(
    new Proxy(instance.ctx, PublicInstanceProxyHandlers),
  );
  if (setup) {
    const setupContext = (instance.setupContext =
      setup.length > 1 ? createSetupContext(instance) : null);
    const setupResult = setup(instance.props, setupContext);
    handleSetupResult(instance, setupResult);
  } else {
    finishedComponent(instance);
  }
}
```

主要的逻辑其实就是存在 `setup` 执行, 不存在就执行 `finishedComponent`
我们都知道 `setup` 的两个参数是 `props, context`, 这里通过 `function.length` 来判断需不需要传入 `context`,
然后调用处理 `setupResult` 的方法 `handleSetupResult`

### handleSetupResult

`setupResult` 我们希望的是要么返回一个对象作为 `state`, 要么返回一个方法作为 `render`

```typescript
function handleSetupResult(instance, setupResult) {
  if (isFunction(setupResult)) {
    instance.render = setupResult;
  } else if (isObject(setupResult)) {
    // proxyRefs 是不是很熟, 访问 ref 不用 .value
    instance.setupState = proxyRefs(setupState);
    exposeSetupStateOnRenderContext(instance);
  }
  finishedComponent(instance);
}
```

为 `instance.render/setupState` 赋值完后, 调用的是 `finishedComponent`, 下面我们看看 `finishedComponent` 做了啥

### finishedComponent

想想还有哪些情况是没有处理的

1. 存在 `setupResult` 不作为 `render`, 作为的是 `setupState`, 所以需要处理 `render`
2. 处理 `optionsApi`

是不是还是没有看见处理 `optionsApi` 的地方, 想想 `optionsApi` 里面有啥 `beforeCreate/created` 这两个钩子是吧, 官方推出的声明周期执行 `setup` 其实是在 `beforeCreate/created` 前面的, 这样是不是就可以理解了呢?

```typescript
function finishedComponent(instance) {
  const Component = instance.type;

  if (!instance.render) {
    // if (!Componet.render) {
    //   // todo template complie
    // }
    instance.render = Component.render || NOOP;
  }

  applyOptions(instance);
}
```

这时会检查 `instance.render`是否存在, 不存在就使用 `Component.render`, 所以现在知道 `setup` 作为 `render` 的优先级是比 `optionsApi.render` 优先级高了吧, 这里其实比模版的优先级都高, 因为 模版编译生成的`render`会赋值给 `Component.render`

最后处理 `data, methods` 这些的就应该在 `applyOptions` 中处理了

### applyOptions

```typescript
function applyOptions(instance) {
  const options = instance.type; // 我这里没有处理 mixins
  const publicThis = instance.proxy; // 获取 this
  const ctx = instance.ctx;

  if (options.beforeCreate) {
    beforeCreate.call(publicThis);
  }

  const {
    data: dataOptions,
    computed: computedOptions,
    methods,
    watch: watchOptions,
    provide: provideOptions,
    inject: injectOptions,
    created,
    beforeMount,
    mounted,
    beforeUpdate,
    updated,
    activated,
    deactivated,
    beforeDestroy,
    beforeUnmount,
    destroyed,
    unmounted,
    render,
    expose,
    components,
    directives,
    filters,
  } = options;

  // 处理 inject
  // 处理 method 做的只有绑定this 和 能让 this.xx 访问到 methods.xx
  if (methods) {
    for (const key in methods) {
      const handler = methods[key];
      if (isFunction(handler)) {
        Object.defineProperty(ctx, key, {
          configurable: true,
          enumerable: true,
          writable: true,
          value: handler.bind(publicThis),
        });
      }
    }
  }
  // 处理 data
  // 处理 computed
  // 处理 watch
  // 处理 provide
  if (provideOptions) {
    /**
     * 1. provide: {}
     * 2. provide: () => {}
     */
    const provides = isFunction(provideOptions)
      ? provideOptions.call(publicThis)
      : provideOptions;
    Reflect.ownKeys(provides).forEach((key) => {
      provide(key, provides[key]);
    });
  }
  if (created) {
    created.call(publicThis);
  }

  // 注册 生命周期钩子
  function registerLifecycleHook(
    register: Function,
    hook?: Function | Function[],
  ) {
    if (isArray(hook)) {
      hook.forEach((_hook) => register(_hook.bind(publicThis)));
    } else if (hook) {
      register(hook.bind(publicThis));
    }
  }
  registerLifecycleHook(onBeforeMount, beforeMount);
  registerLifecycleHook(onMounted, mounted);
  registerLifecycleHook(onBeforeUpdate, beforeUpdate);
  registerLifecycleHook(onUpdated, updated);
  registerLifecycleHook(onActivated, activated);
  registerLifecycleHook(onDeactivated, deactivated);
  registerLifecycleHook(onBeforeUnmount, beforeUnmount);
  registerLifecycleHook(onUnmounted, unmounted);

  // 处理 expose
  if (isArray(expose)) {
    if (expose.length) {
      const exposed = instance.exposed || (instance.exposed = {});
      expose.forEach((key) => {
        Object.defineProperty(exposed, key, {
          get: () => publicThis[key],
          set: (val) => (publicThis[key] = val),
        });
      });
    } else if (!instance.exposed) {
      instance.exposed = {};
    }
  }
  // 处理render
  if (render && instance.render === NOOP) {
    instance.render = render;
  }
  // 处理 子组件
  components && (instance.components = components);
  // 处理 指令
  directives && (instance.directives = directives);
  // 处理 fliter
  filters && (instance.filters = filters);
}
```

#### injectOptions

先复习下 `vue2.x` 中 `inject` 用法:

1. `inject: ["name"]`
2. `inject: { key }`
3. inject: {key: { from: 'key', default: 'defaultKey' }}`

而 `vue3.x` 的 `inject` 用法:

1. `inject(key, defaultValue)`
2. `inject(key)`
3. `inject(key, () => defaultValue, true)`

```typescript
if (injectOptions) {
  resolveInjectOptions(injectOptions, ctx);
}
function resolveInjectOptions(injectOptions, ctx) {
  if (isArray(injectOptions)) {
    // ['key'] => {'key': key} 对应用法第一种
    injectOptions = normalizeInject(injectOptions);
  }
  for (const key in injectOptions) {
    const opt = injectOptions[key];
    let injected;
    if (isObject(opt)) {
      // 对应用法第三种
      if ('default' in opt) {
        injected = inject(opt.from || key, opt,default)
      } else {
        injected = inject(opt.from || key)
      }
    } else {
      // 对应用法第二种
      injected = inject(opt)
    }
    if (isRef(injected)) {
      Object.defineProperty(ctx, key, {
        enumerable: true,
        configurable: true,
        get: () => injected.value,
        set: v => (injected.value = v)
      })
    } else {
      ctx[key] = injected
    }
  }
}

// 就是数组转换成对象
function normalizeInject(raw) {
  if (isArray(raw)) {
    const res = {};
    for(let i = 0; i< raw.length; i++) {
      res[raw[i]] = raw[i]
    }
    return res
  }
  return raw
}
```

#### dataOptions

因为 `data` 方法返回的是一个对象, 所以我们需要用 `reactive` 处理, 然后再 使 `this.xx` 访问到 `data.xx`

```typescript
if (dataOptions) {
  if (isFunction(dataOptions)) {
    // 注意 this
    const data = dataOptions.call(publicThis, publicThis);
    if (isObject(data)) {
      // 赋值给 instance.data
      instance.data = reactive(data);
      for (const key in data) {
        Object.defineProperty(ctx, key, {
          configurable: true,
          enumerable: true,
          get: () => data[key],
          set: NOOP,
        });
      }
    }
  }
}
```

#### computedOptions

`vue2.x` 中的 `computed` 用法:

1. `{key: (){ return this.xxx }}`
2. `{key: { get(){}, set(){} } }`

`vue3.x` 中

1. `computed({get, set})`
2. `computed(getterFn)`

```typescript
if (computedOptions) {
  for (const key in computedOptions) {
    const opt = computedOptions[key];
    const get = isFunction(opt)
      ? opt.bind(publicThis, publicThis)
      : isFunction(opt.get)
      ? opt.get.bind(publicThis, publicThis)
      : NOOP;
    const set =
      !isFunction(opt) && isFunction(opt.set) ? opt.set.bind(publicThis) : NOOP;

    const c = computed({
      get,
      set,
    });
    Object.defineProperty(ctx, key, {
      enumerable: true,
      configurable: true,
      get: () => c.value,
      set: (v) => (c.value = v),
    });
  }
}
```

#### watchOptions

`vue2.x` watch 用法

1. `{ dataKey: func }`
2. `{ key: methodsKey }`
3. `{ key: { handler: func, ... otherWatchOptions } }`
4. `{ key: { handler: methodsKey }, ... otherWatchOptions }`
5. `{ key: [methodsKey, func, { handler: methodsKey }, ... otherWatchOptions }] }`
6. `{pathStr: func}`

```typescript
if (watchOptions) {
  for (const key in watchOptions) {
    createWatcher(watchOptions[key], ctx, publicThis, key);
  }
}

function createWatcher(raw, ctx, publicThis, key) {
  const getter = key.includes('.')
    ? createPathGetter(publicThis, key) // 处理 `pathStr`
    : () => publicThis[key];
  if (isString(raw)) {
    // 第二种用法
    const handler = ctx[raw];
    watch(getter, handler);
  } else if (isFunction(raw)) {
    // 第一种用法
    watch(getter, raw.bind(publicThis));
  } else if (isObject(raw)) {
    if (isArray(raw)) {
      // 第五种
      raw.forEach((r) => createWatcher(r, ctx, publicThis, key));
    } else {
      // 第三种 和 第四种
      const handler = isFunction(raw.handler) > raw.handler.bind(publicThis) : ctx[raw.handler]
      watch(getter, handler, raw)
    }
  }
}

// "a.b.c" => ctx[a][b][c]
function createPathGetter(ctx, path) {
  const segments = path.split('.');
  return () => {
    let cur = ctx;
    for (let i = 0; i < segments.length; i++) {
      cur = cur[segments[i]];
    }
    return cur;
  };
}
```

### setupRenderEffect

```typescript
function setupRenderEffect(instance, initialVNode, contaier, anchor) {
  const componentUpdateFn = () => {
    if (!instance.isMounted) {
      const { bm, m } = instance;
      if (bm) {
        // 调用beforeMount
        bm.forEach((fn) => fn());
      }
      const subTree = (instance.subTree = instance.render());
      patch(null, subTree, container, anchor);
      initialVNode.el = subTree.el;
      if (m) {
        // 调用 mounted
        m.forEach((fn) => fn());
      }
      instance.isMounted = true;
    } else {
      // update
    }
  };

  const effect = (instance.effect = new ReactiveEffect(componentUpdateFn));
  const update = (instance.update = () => effect.run());

  update();
}
```

# 总结

主要的步骤大概如下:

1. 创建组件 `instance`
2. 执行 `setupComponent`, 给 `instance` 的一些属性赋值, 比如 `setupState, data`
   1. 初始化 `props`, 'slots'
   2. 判断是否是 `STATEFUL_COMPONENT`, 是执行 `setupStatefulComponent` 否则执行 `finishComponent`
   3. `setupStatefulComponent` 主要做的就是初始化 `instance.proxy` 这个作为 `this`,通过 `defineProperty`; 调用 `exposePropsOnRenderContext` 让 `ctx.xx `能访问 `props.xx`; 然后执行 `setup` 方法, 获取 `setupResult` 然后执行 `handleSetupResult` 方法, 这里执行 `setup` 时 通过 `setup.length` 通过判断定义的形参数量来决定是否创建 `context`
      1. `handleSetupResult` 主要做的就是判断 `setupResult` 来为 `instance.render` / `instance.setupState` 赋值, 赋值 `setupState`时, 通过 `exposeSetupStateOnRenderContext` 实现 `ctx.xx` 访问 `setupState.xx`
      2. 最后执行 `finishComponent`
   4. `finishComponent` 主要做的就是 校验 `render`, 然后调用 `appOptions` 处理 `optionsApi`
3. 然后调用 `setupRenderEffect` 挂载


