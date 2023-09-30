---
marp: true
---

# reactive

作为 `vue3.x` 中 两个 `响应式化` 我们的数据的 `api` 之一, 可谓是相当重要的存在, 接下来我们简单的深入一下

## createReactiveObject

不论 `reactive`, `readonly`, `shallowReactive`, `shallowReadonly`, 其实本质都是都是调用的 `createReactiveObject` 这个方法, 我们也都知道, `reactive` 返回的是一个 `Proxy`, 所以主要的逻辑 其实就是 `return new Proxy(target, hander)`

```typescript
function createReactiveObject(
  target: Target,
  isReadonly: boolean,
  baseHandlers: ProxyHandler<any>,
  collectionHandlers: ProxyHandler<any>,
  proxyMap: WeakMap<Target, any>,
) {
  if (!isObject(target)) {
    if (__DEV__) {
      console.warn(`value cannot be made reactive: ${String(target)}`);
    }
    return target;
  }
  if (
    target[ReactiveFlags.RAW] &&
    !(isReadonly && target[ReactiveFlags.IS_REACTIVE])
  ) {
    return target;
  }
  const existingProxy = proxyMap.get(target);
  if (existingProxy) {
    return existingProxy;
  }
  const targetType = getTargetType(target);
  if (targetType === TargetType.INVALID) {
    return target;
  }
  const proxy = new Proxy(
    target,
    targetType === TargetType.COLLECTION ? collectionHandlers : baseHandlers,
  );
  proxyMap.set(target, proxy);
  return proxy;
}
```

代码逻辑很简单:

1. `Proxy` 只能代理对象
2. 判断是否是已经代理过的 `对象`, 空间换时间去保存, 也就能确保 同一个 `target` 的 `proxy` 一定是相同的
3. 排除不需要被 `代理` 的 对象
4. 调用 `new Proxy` 然后保存 `proxy`, 最后返回
