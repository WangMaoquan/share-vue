---
marp: true
---

# h

`h` 这个方法, 在 `vue2.x` 可能大家用的不多, 它是在 `render(h){}` 的第一个参数就是 `h`, 作用就是创建对应的 `vnode`

```typescript
export function h(type: any, propsOrChildren?: any, children?: any): VNode {
  const l = arguments.length;
  if (l === 2) {
    if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      if (isVNode(propsOrChildren)) {
        return createVNode(type, null, [propsOrChildren]);
      }
      return createVNode(type, propsOrChildren);
    } else {
      return createVNode(type, null, propsOrChildren);
    }
  } else {
    if (l > 3) {
      children = Array.prototype.slice.call(arguments, 2);
    } else if (l === 3 && isVNode(children)) {
      children = [children];
    }
    return createVNode(type, propsOrChildren, children);
  }
}
```

主要作用就是处理好 `参数` 然后传给 `createVNode`

---

## createVNode

返回一个 `VNode`, `createVNode` 你可以理解为实际是 `_createVNode`

```typescript
function _createVNode(
  type: VNodeTypes | ClassComponent | typeof NULL_DYNAMIC_COMPONENT,
  props: (Data & VNodeProps) | null = null,
  children: unknown = null,
  patchFlag: number = 0,
  dynamicProps: string[] | null = null,
  isBlockNode = false,
): VNode {
  /** */
  if (isClassComponent(type)) {
    type = type.__vccOpts;
  }
  if (__COMPAT__) {
    type = convertLegacyComponent(type, currentRenderingInstance);
  }
  if (props) {
    /** 处理props */
  }
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT
    : __FEATURE_SUSPENSE__ && isSuspense(type)
    ? ShapeFlags.SUSPENSE
    : isTeleport(type)
    ? ShapeFlags.TELEPORT
    : isObject(type)
    ? ShapeFlags.STATEFUL_COMPONENT
    : isFunction(type)
    ? ShapeFlags.FUNCTIONAL_COMPONENT
    : 0;
  return createBaseVNode(
    type,
    props,
    children,
    patchFlag,
    dynamicProps,
    shapeFlag,
    isBlockNode,
    true,
  );
}
```

1. 处理 `type`
2. 处理 `props`
3. 返回 `createBaseVNode` 的值

这里我们看出 `_createVNode` 其实也是处理参数, 最终调用的是 `createBaseVNode`, 在介绍 `createBaseVNode` 之前, 我先介绍下 `ShapeFlags`

---

### ShapeFlags

`ShapeFlags` 形状标记(ps: 强行翻译), 是一个 `枚举类型`

```typescript
export const enum ShapeFlags {
  ELEMENT = 1, // 可以理解为 `div,p` 这些 `DOM` 元素
  FUNCTIONAL_COMPONENT = 1 << 1, // 函数组件
  STATEFUL_COMPONENT = 1 << 2, // 状态组件
  TEXT_CHILDREN = 1 << 3, // children 为 text 的 <div>xxx</div>
  ARRAY_CHILDREN = 1 << 4, // children 为 array 的 <div><p>1</p><p>2</p></div>
  SLOTS_CHILDREN = 1 << 5, // children 为 slots 的 <div><template v-slots="xxx"></template></div>
  TELEPORT = 1 << 6, // Teleport 组件
  SUSPENSE = 1 << 7, // Suspense 组件
  COMPONENT_SHOULD_KEEP_ALIVE = 1 << 8, // 应该被 keepAlive 收集的组件
  COMPONENT_KEPT_ALIVE = 1 << 9, // 已经被 keepAlive 收集的组件
  COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT, // 组件
}
```

一看每一项是不是大概就明白了, 其实就是定义 `VNode的类型(组件其实也是一个 VNode)`, 下面我们看 `createBaseVNode`

---

### createBaseVNode

```typescript
function createBaseVNode(
  type: VNodeTypes | ClassComponent | typeof NULL_DYNAMIC_COMPONENT,
  props: (Data & VNodeProps) | null = null,
  children: unknown = null,
  patchFlag = 0,
  dynamicProps: string[] | null = null,
  shapeFlag = type === Fragment ? 0 : ShapeFlags.ELEMENT,
  isBlockNode = false,
  needFullChildrenNormalization = false,
) {
  const vnode = {
    __v_isVNode: true,
    __v_skip: true,
    type,
    props,
    key: props && normalizeKey(props),
    ref: props && normalizeRef(props),
    scopeId: currentScopeId,
    slotScopeIds: null,
    children,
    component: null,
    suspense: null,
    ssContent: null,
    ssFallback: null,
    dirs: null,
    transition: null,
    el: null,
    anchor: null,
    target: null,
    targetAnchor: null,
    staticCount: 0,
    shapeFlag,
    patchFlag,
    dynamicProps,
    dynamicChildren: null,
    appContext: null,
    ctx: currentRenderingInstance,
  } as VNode;
  /** 处理 children, 编译优化, 兼容 vue2.x */
  return vnode;
}
```

主要的功能就是返回一个 `vnode`, 我简单说一个属性

1. `__v_isVNode`: vnode 标志
2. `__v_skip`: 跳过 `响应式化` 的标志
3. `type`: `h` 方法的第一个参数, 可以说是 `div`, `p` 这样的 `DOM tag`, 也可以是一个对象 `h(customComp)` 这样的
4. `props`: 被处理后的 `h` 方法的第二个参数(是对象情况下)
5. `children`: 子节点
6. `component`: 当前的组件实例
7. `dirs`: 指令
8. `shapeFlag`: 类型
9. `patchFlag`, `dynamicProps`, `dynamicChildren`: 都是和优化有关的, 后面会细讲
