---
marp: true
---

# createApp

这个方法返回的 `app` 其实也就是 我们通常使用时的 `app`, 也就是实现了 `use`, `mount`, `unmount`, `component`, `directive`, 下面看看内部实现

```typescript
function createApp(rootComponent, rootProps = null) {
  if (!isFunction(rootComponent)) {
    rootComponent = extend({}, rootComponent);
  }
  if (rootProps != null && !isObject(rootProps)) {
    __DEV__ && warn(`root props passed to app.mount() must be an object.`);
    rootProps = null;
  }
  const context = createAppContext();
  /** */
  const installedPlugins = new Set();
  let isMounted = false;
  const app: App = (context.app = {
    _uid: uid++,
    _component: rootComponent as ConcreteComponent,
    _props: rootProps,
    _container: null,
    _context: context,
    _instance: null,
    version,
    get config() {
      /** */
    },
    set config(v) {
      /** */
    },
    use(plugin: Plugin, ...options: any[]) {
      /** */
    },
    mixin(mixin: ComponentOptions) {
      /** */
    },
    component(name: string, component?: Component): any {
      /** */
    },
    directive(name: string, directive?: Directive) {
      /** */
    },
    mount(/** */): any {
      /** */
    },
    unmount() {
      /** */
    },
    provide(key, value) {
      /** */
    },
    runWithContext(fn) {
      /** */
    },
  });
  if (__COMPAT__) {
    installAppCompatProperties(app, context, render);
  }
  return app;
}
```

干得事情不复杂

1. 处理 `rootComponent, rootProps` 两个参数
2. 初始化 `context` 全局上下文对象, `installedPlugins` 已经注册过的插件集合, `isMounted`: `app` 是否挂载挂载的标记
3. 初始化 `app`, 并初始化 `context.app`
4. `__COMPAT__`下兼容
5. 返回 `app`

---

## createAppContext

让我们看看 `context` 上都有啥

```typescript
export function createAppContext(): AppContext {
  return {
    app: null as any,
    config: {
      isNativeTag: NO,
      performance: false,
      globalProperties: {},
      optionMergeStrategies: {},
      errorHandler: undefined,
      warnHandler: undefined,
      compilerOptions: {},
    },
    mixins: [],
    components: {},
    directives: {},
    provides: Object.create(null),
    optionsCache: new WeakMap(),
    propsCache: new WeakMap(),
    emitsCache: new WeakMap(),
  };
}
```

- `app`: 存放当前 `app` 的
- `config`: 一些用户自定义配置, 比如 `globalProperties` 存放公共方法的, 类比 `vue2.x` 挂载在原型链上的
- `mixins`: 保存着调用 `app.mixin` 注册的混入
- `components`: 保存着调用 `app.component` 注册的全局组件
- `directives`: 保存着调用 `app.directives` 注册的全局指令
- `provides`: 保存着 `app.provider` 提供的
- `optionsCache/propsCache/emitsCache`: 对应的缓存

---

## config

```typescript
const app = {
  get config() {
    return context.config;
  },
  set config(v) {
    if (__DEV__) {
      warn(`app.config cannot be replaced. Modify individual options instead.`);
    }
  },
};
```

获取/配置 `context.config`

---

## use

```typescript
const app = {
  use(plugin: Plugin, ...options: any[]) {
    if (installedPlugins.has(plugin)) {
      __DEV__ && warn(`Plugin has already been applied to target app.`);
    } else if (plugin && isFunction(plugin.install)) {
      installedPlugins.add(plugin);
      plugin.install(app, ...options);
    } else if (isFunction(plugin)) {
      installedPlugins.add(plugin);
      plugin(app, ...options);
    } else if (__DEV__) {
      warn(
        `A plugin must either be a function or an object with an "install" ` +
          `function.`,
      );
    }
    return app;
  },
};
```

实现也很简单

1. 判断是否注册
2. 判断 `plugin` 是否满足: 是一个 `方法` 或者 是一个实现了 `install` 方法的 `对象`
3. 添加进 `installedPlugins`, 然后执行

---

## mixin

```typescript
const app = {
  mixin(mixin: ComponentOptions) {
    if (__FEATURE_OPTIONS_API__) {
      if (!context.mixins.includes(mixin)) {
        context.mixins.push(mixin);
      } else if (__DEV__) {
        warn(
          'Mixin has already been applied to target app' +
            (mixin.name ? `: ${mixin.name}` : ''),
        );
      }
    } else if (__DEV__) {
      warn('Mixins are only available in builds supporting Options API');
    }
    return app;
  },
};
```

混入是 `vue2.x` 的, 其实 `3.x` 没必要使用, 所以 `compositionApi` 情况下使用 `mixin` 会给个警告

`mixin` 会导致 变量重名/来源不确定 进而不好调试..

---

## component

```typescript
const app = {
  component(name: string, component?: Component): any {
    if (__DEV__) {
      validateComponentName(name, context.config);
    }
    if (!component) {
      return context.components[name];
    }
    if (__DEV__ && context.components[name]) {
      warn(`Component "${name}" has already been registered in target app.`);
    }
    context.components[name] = component;
    return app;
  },
};
```

`component` 只传一个参数就是获取全局组件, 传两个参数就是注册全局组件, 获取或者注册从`context.components` 获取或者注册

---

## directive

```typescript
const app = {
  directive(name: string, directive?: Directive) {
    if (__DEV__) {
      validateDirectiveName(name);
    }

    if (!directive) {
      return context.directives[name] as any;
    }
    if (__DEV__ && context.directives[name]) {
      warn(`Directive "${name}" has already been registered in target app.`);
    }
    context.directives[name] = directive;
    return app;
  },
};
```

`directive` 只传一个参数就是获取全局指令, 传两个参数就是注册全局指令, 获取或者注册从`context.directives` 获取或者注册

---

## mount

app 的挂载方法

```typescript
const app = {
  mount(rootContainer: HostElement, isHydrate?: boolean, isSVG?: boolean): any {
    if (!isMounted) {
      if (__DEV__ && (rootContainer as any).__vue_app__) {
        warn(
          `There is already an app instance mounted on the host container.\n` +
            ` If you want to mount another app on the same host container,` +
            ` you need to unmount the previous app by calling \`app.unmount()\` first.`,
        );
      }
      /** render */
      isMounted = true;
      app._container = rootContainer;
      return getExposeProxy(vnode.component!) || vnode.component!.proxy;
    } else if (__DEV__) {
      warn(
        `App has already been mounted.\n` +
          `If you want to remount the same app, move your app creation logic ` +
          `into a factory function and create fresh app instances for each ` +
          `mount - e.g. \`const createMyApp = () => createApp(App)\``,
      );
    }
  },
};
```

1. 判断 `rootContainer` 是否已经挂载
2. 调用 `render` 这里的 `render` 是 `createAppAPI` 传入的
3. `isMounted` 为 true
4. `app._container` 赋值为 rootContainer, 这里 `rootContainer` 其实就是我们的 `document.querySelector('#app')`

---

app 的卸载方法

## unmount

```typescript
const app = {
  unmount() {
    if (isMounted) {
      render(null, app._container);
      delete app._container.__vue_app__;
    } else if (__DEV__) {
      warn(`Cannot unmount an app that is not mounted.`);
    }
  },
};
```

1. 调用 `render` 卸载
2. 删除 `app._container.__vue_app__`

---

## provide

```typescript
const app = {
  provide(key, value) {
    if (__DEV__ && (key as string | symbol) in context.provides) {
      warn(
        `App already provides property with key "${String(key)}". ` +
          `It will be overwritten with the new value.`,
      );
    }

    context.provides[key as string | symbol] = value;

    return app;
  },
};
```

保存在 `context.provides` 上

---

## runWithContext

```typescript
const app = {
  runWithContext(fn) {
    currentApp = app;
    try {
      return fn();
    } finally {
      currentApp = null;
    }
  },
};
```

确保某些 `api` 能够在 `非setup` 环境中运行, 详细可以件这个 [pull](https://github.com/vuejs/core/pull/7451)

拿`pinia` 举例, 代码位置在 `createSetupStore` 中

```typescript
const runWithContext =
  (pinia._a && pinia._a.runWithContext) || fallbackRunWithContext;
```

`createSetupStore` 是在 `useStore` 里面调用的, 所以我们可以 `main.ts` 中这么用

```typescript
import { useCounter } from './store';
const couter = useCounter();
console.log(couter);
```

---

# createApp

之前我们可以看出 `createApp` 只是接受一个 `挂载元素`, 但是具体怎么获取 `挂载元素` 是不是没有实现? 这是为啥? `多平台`, 所以我们看看 `浏览器平台` 的实现, 也就是我们最常用的 `createApp`

代码在 `runtime-dom`

```typescript
export const createApp = ((...args) => {
  const app = ensureRenderer().createApp(...args);
  /** */
  const { mount } = app;
  app.mount = (containerOrSelector: Element | ShadowRoot | string): any => {
    const container = normalizeContainer(containerOrSelector);
    if (!container) return;

    const component = app._component;
    /** validate component */
    container.innerHTML = '';
    const proxy = mount(container, false, container instanceof SVGElement);
    /** 处理闪烁 */
    if (container instanceof Element) {
      container.removeAttribute('v-cloak');
      container.setAttribute('data-v-app', '');
    }
    return proxy;
  };

  return app;
}) as CreateAppFunction<Element>;
```

本质还是调用 `renderer.createApp.render`, 返回我们属性的 `app`,
`const { mount } = app; app.mount = function () {}`, 熟悉保存原来的, 自己定义一个根据平台来的, 然后在 `内部调用` 原来的 `mount`
