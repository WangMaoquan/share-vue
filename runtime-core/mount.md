# mount

也就是 `app.mount`, `createApp`那里简单提到了一下, 针对不同的平台 `mount` 也需要被 包一下, 这里主要讲的就是 `浏览器平台`

```typescript
const { mount } = app;
app.mount = (containerOrSelector: Element | ShadowRoot | string): any => {
  const container = normalizeContainer(containerOrSelector);
  if (!container) return;
  /** */
  const proxy = mount(container, false, container instanceof SVGElement);
  /** */
  return proxy;
};
```

主要做的事情不复杂

1. 获取挂载的 `DOM`
2. 调用原本的 `mount`

其实 `mount` 的实现 我们在 `createApp` 也提过, 主要就是调用 `render` 方法, 下面我们进入 `render`

## render

`render` 渲染, 其实就是将 `vnode` 变成 `真实DOM` 的过程, 中间我们可能会遇到 `挂载/更新 vnode` 这一类操作 统称 `patch`, 意为 `打补丁` 还有 `卸载 vnode` 统称为 `unmount`

```typescript
const render: RootRenderFunction = (vnode, contaier, isSVG) => {
  if (vnode == null) {
    if (contaier._vnode) {
      unmount(contaier._vnode, null, null, true);
    }
  } else {
    patch(container._vnode || null, vnode, container, null, null, null, isSVG);
  }
  contaier._vnode = vnode;
};
```

根据 `vnode` 的有无, 判断是 `patch` 还是 `unmount`

## patch

`patch` 打补丁, 那么是怎么打补丁呢? `vue` 的 `patch` 是 `组件级别` 的, 为啥会是组件级别的, 就是因为 `patch` 方法

接受 `n1, n2, container, anchor(我简单说这四个)` 参数

- `n1` 代表旧的 `vnode`
- `n2` 代表新的 `vnode`
- `container` 代表我们挂载的真实 `DOM`
- `anchor` 代表被挂载的 `DOM` 的 `锚点`, 可以理解为 `插入子节点`时 以哪个节点为基准插入

组件级别更新也就是比较 `n1 与 n2` 其实也就是同一个组件 `更新前的状态` 与 `更新后的状态`的比较, 很明显 `n1, n2` 代表的一颗 `vnode tree`, 所以树的遍历 `DFS`

```typescript
const patch: PatchFn = (n1, n2, container, anchor /** */) => {
  if (n1 === n2) {
    return;
  }
  // 这里 n1 和 n2 不能复用, 所以直接卸载
  if (n1 && isSameVNode(n1, n2)) {
    anchor = getNextHostNode(n1);
    unmount(n1, parent);
    n1 = null;
  }
  const { type, sharpFlag } = n2;
  switch (type) {
    case Text:
      // 处理 文本
      break;
    case Comment:
      // 处理 注释
      break;
    case Static:
      // 处理 静态节点
      break;
    case Fragment:
      // 处理 fragment
      break;
    default:
      if (sharpFlag & SharpFlags.ELEMENT) {
        // 处理 元素节点
      } else if (sharpFlag & SharpFlags.COMPONENT) {
        //  处理组件
      } else if (sharpFlag & SharpFlags.TELEPORT) {
        //  处理 TELEPORT
      } else if (sharpFlag & SharpFlags.SUSPENSE) {
        // 处理 SUSPENSE
      } else {
        // 警告位置类型
      }
      break;
  }
};
```

`patch` 干得事情就是 `分发处理`, 调用 `各个类型的` 方法去处理, 这里也用到 `位运算`, 我们先看看 怎么处理 `ELEMENT`

### processElement

```typescript
const processElement = (n1, n2, container, anchor) => {
  if (n1 == null) {
    // mount
  } else {
    // update
  }
};
```

存在 `n1` 就是挂载, 否则就是 更新

#### mountElement

挂载元素也就是挂载真实 `DOM` 是不是就需要用到我们的 `rendererOptions` 中的方法了

```typescript
const {
  createElement: hostCreateElement,
  patchProp: hostPatchProp,
  insert: hostInsert,
  setElementText: hostSetElementText,
} = rendererOptions;

const mountElement = (vnode, container, anchor /** */) => {
  let el;
  const { type, props, sharpFlag } = vnode;
  // 这里的 el 其实就是真实 DOM 了
  el = vnode.el = hostCreateElement(vnode.type, props);

  if (sharpFlag & SharpFlags.TEXT_CHILDREN) {
    // 处理文本的子节点 如 `<div>123</div>`
    hostSetElementText(el, vnode.children);
  } else if (sharpFlag & SharpFlags.ARRAY_CHILDREN) {
    //  处理数组子节点 如 `<div><p>1</p><p>2</p><div>`
    mountChildren(vnode.children, el);
  }

  if (props) {
    for (const key in props) {
      hostPatchProp(el, key, props[key] /** */);
    }
  }
  /** vnodeHook, 处理 transition  */
  hostInsert(el, contaier, anchor);
  /** call */
};
```

1. 创建对应的真实 `DOM`
2. 处理子节点
3. 处理 `props`
4. 将真实 `DOM` 插入到页面

#### mountChildren

其实也就是对 `children` 中的每一项做 `patch`

```typescript
const mountChildren = (children, container, anchor) => {
  for (let i = 0; i < children.length; i++) {
    patch(null, children[i], contaier, anchor);
  }
};
```

##### mount element

`vue` 怎么挂载 `element` 的流程我们已经熟悉一遍, 我们回顾下

1. `app.mount` 需要兼容不同平台, 也即是我们需要获取不同平台的 `container`, 所以需要把 原本的 `mount` 包一层
2. `mount` 其实就是调用 `render` 方法去处理
3. `render` 通过传入的第一个参数判断是 `patch` 还是 `unmount`
4. `patch` 主要做的就是 根据 `vnode` 的 `type, shapeFlag` 来调用处理不同类的组件
5. `processElement` 是处理 `element` 的方法, 根据第一个参数 `n1` 判断是 `mount(挂载)` 还是 `patch(更新)`
6. `mountElement` 是挂载 `element` 的方法, 思路其实很明确, 调用 `rendererOptions.createElement` 创建我们的真实 `DOM`, 然后调用`mountChildren` 挂载子节点, 然后调用 `hostPatchProp` 处理属性, 最后调用 `hostInsert` 将完成的 `DOM` 插入到页面
7. `mountChildren` 挂载子节点, 本质就是让 `children` 每一项 调用 `patch`

#### patchElement
