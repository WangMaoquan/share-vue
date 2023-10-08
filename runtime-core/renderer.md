---
marp: true
---

# renderer

`renderer` 意为渲染器, 主要的作用呢可以理解为 将 `虚拟DOM` 渲染成 `特定平台`上的 `真实元素`, 那么怎么去 实现 针对特定平台呢? 即怎么去讲 平台特有的 抽离出来? 下面我们举个例子: 比如 在 `浏览器平台`, `renderer` 通过调用 `document.createElement` 来创建元素, `Node.appendChild` 来插入元素, `Node.insertBefore` 插入兄弟节点, `Node.removeChild` 来删除子节点, 是不是 抽离出来的 应该都需要实现 `创建/插入/删除 等等等`的功能 这些功能. 我们把这些功能抽离出来, 作为参数 传给我们的 `renderer`, 是不是就能针对不同平台

```typescript
const nodeOps = {
  createElement(tag) {
    return document.createElement(tag);
  },
  createText: (text) => document.createTextNode(text),
  createComment: (text) => document.createComment(text),
  setText: (node, text) => {
    node.nodeValue = text;
  },
  insert: (child, parent) => {
    parent.insertBefore(child);
  },
  remove: (child) => {
    const parent = child.parentNode;
    if (parent) {
      parent.removeChild(child);
    }
  },
  /** */
};
```

`nodeOps` 就是针对 `浏览器平台` 的 封装

---

## createRenderer

下面我们进入 `createRenderer` 这个方法

```typescript
export function createRenderer<
  HostNode = RendererNode,
  HostElement = RendererElement,
>(options: RendererOptions<HostNode, HostElement>) {
  return baseCreateRenderer<HostNode, HostElement>(options);
}
```

可以看出最主要的是调用了 `baseCreateRenderer`, 这里我再介绍下 `RendererOptions`, 这个类型 其实就是我们要在 `不同平台` 需要实现的 配置对象

```typescript
export interface RendererOptions<
  HostNode = RendererNode,
  HostElement = RendererElement,
> {
  patchProp(/** */): void; // 处理 props 的 添加/更新/删除
  insert(/** */): void; // 插入节点
  remove(el: HostNode): void; // 删除节点
  createElement(/** */): HostElement; // 创建元素
  createText(text: string): HostNode; // 创建文本
  createComment(text: string): HostNode; // 创建注释
  setText(node: HostNode, text: string): void; // 设置文本
  setElementText(node: HostElement, text: string): void; // 设置元素文本
  parentNode(node: HostNode): HostElement | null; // 获取父级节点
  nextSibling(node: HostNode): HostNode | null; // 获取下一个兄弟节点
  querySelector?(selector: string): HostElement | null; // 查询元素
  setScopeId?(el: HostElement, id: string): void; // 设置scopeId
  cloneNode?(node: HostNode): HostNode; // 克隆元素
  insertStaticContent?(/** */): [HostNode, HostNode]; // 插入静态内容
}
```

下面我们开始介绍 `baseCreateRenderer`

---

### baseCreateRenderer

```typescript
function baseCreateRenderer<
  HostNode = RendererNode,
  HostElement = RendererElement,
>(options: RendererOptions<HostNode, HostElement>): Renderer<HostElement>;

function baseCreateRenderer(
  options: RendererOptions<Node, Element>,
  createHydrationFns: typeof createHydrationFunctions,
): HydrationRenderer;
function baseCreateRenderer(
  options: RendererOptions,
  createHydrationFns?: typeof createHydrationFunctions,
): any {
  /** */
  const {
    insert: hostInsert,
    remove: hostRemove,
    patchProp: hostPatchProp,
    createElement: hostCreateElement,
    createText: hostCreateText,
    createComment: hostCreateComment,
    setText: hostSetText,
    setElementText: hostSetElementText,
    parentNode: hostParentNode,
    nextSibling: hostNextSibling,
    setScopeId: hostSetScopeId = NOOP,
    insertStaticContent: hostInsertStaticContent,
  } = options;

  const patch: PatchFn = (/** */) => {
    /** */
  };

  const processText: ProcessTextOrCommentFn = (n1, n2, container, anchor) => {
    /** */
  };

  const processCommentNode: ProcessTextOrCommentFn = (/** */) => {
    /** */
  };

  const mountStaticNode = (/** */) => {
    /** */
  };
  const patchStaticNode = (/** */) => {
    /** */
  };

  const moveStaticNode = (/** */) => {
    /** */
  };

  const removeStaticNode = ({ el, anchor }: VNode) => {
    /** */
  };

  const processElement = (/** */) => {
    /** */
  };

  const mountElement = (/** */) => {
    /** */
  };

  const setScopeId = (/** */) => {
    /** */
  };

  const mountChildren: MountChildrenFn = (/** */) => {
    /** */
  };

  const patchElement = (/** */) => {
    /** */
  };

  const patchBlockChildren: PatchBlockChildrenFn = (/** */) => {
    /** */
  };

  const patchProps = (/** */) => {
    /** */
  };

  const processFragment = (/** */) => {
    /** */
  };

  const processComponent = (/** */) => {
    /** */
  };

  const mountComponent: MountComponentFn = (/** */) => {
    /** */
  };

  const updateComponent = (n1: VNode, n2: VNode, optimized: boolean) => {
    /** */
  };

  const setupRenderEffect: SetupRenderEffectFn = (/** */) => {
    /** */
  };

  const updateComponentPreRender = (/** */) => {
    /** */
  };

  const patchChildren: PatchChildrenFn = (/** */) => {
    /** */
  };

  const patchUnkeyedChildren = (/** */) => {
    /** */
  };

  const patchKeyedChildren = (/** */) => {
    /** */
  };

  const move: MoveFn = (/** */) => {
    /** */
  };

  const unmount: UnmountFn = (/** */) => {
    /** */
  };

  const remove: RemoveFn = (vnode) => {
    /** */
  };

  const removeFragment = (cur: RendererNode, end: RendererNode) => {
    /** */
  };

  const unmountComponent = (/** */) => {
    /** */
  };

  const unmountChildren: UnmountChildrenFn = (/** */) => {
    /** */
  };

  const getNextHostNode: NextFn = (vnode) => {
    /** */
  };

  const render: RootRenderFunction = (vnode, container, isSVG) => {
    /** */
  };
  /** 处理 hydrate*/
  return {
    render,
    hydrate,
    createApp: createAppAPI(render, hydrate),
  };
}
```

代码很多, 我们看看目前我们关心的部分:

1. 处理 `RendererOptions`: 通过解构 将 `RendererOptions` 中的方法拿出来, 用于后面处理时直接调用
2. 返回值: 返回的是一个对象, 包含了 `render, createApp` 方法, 另外 通过闭包创建了 一堆 `renderer` 内部处理的 方法, 看方法名我们大概也能知道是干啥的, 比如 `processXxx` 专门处理 `Xxx` 的, `mountXxx` 挂载 `Xxx`, `patchXxx` 针对 `Xxx` 执行 `patch`

这里的 `createApp`, 我们其实可以知道了, app 实例是怎么来的了 `createAppAPI`

---

## createAppAPI

同样的理由 `createAppAPI` 也要针对 `不同平台`

```typescript
export function createAppAPI<HostElement>(
  render: RootRenderFunction<HostElement>,
  hydrate?: RootHydrateFunction,
): CreateAppFunction<HostElement> {
  return function createApp(rootComponent, rootProps = null) {
    /** */
  };
}
```

主要就是返回 `createApp` 方法

---

### createApp

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
