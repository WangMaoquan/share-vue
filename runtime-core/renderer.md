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

---
