---
marp: true
---

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
