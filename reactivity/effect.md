---
marp: true
---

# targetMap

之前我们已经讲过了`收集依赖` 与 `派发更新` 的触发时机, 那么我们需要思考, 收集是不是需要一个 `容器` 去保存, 派发是不是要从 `容器` 中获取到然后再去执行, 我们先把 `容器` 比作水桶(带隔层的), 每一个 `对象` 就是 `一层(depsMap)`, 我们是不是还得需要给每一层分成很多 `房间(dep)`, 这代表对象的每一个 `key` 所收集的依赖的房间. 这么讲了 `targetMap` 长什么样应该够清晰了吧. `targetMap` 是一个 `WeakMap` 保存着 `target` 与 `depsMap` 的关系, `depsMap` 是一个 `Map` 保存着 `key` 与 `dep` 的关系

# track

`track` 收集, 那么是怎么去收集的呢? 想想看 需要做哪些事?

1. 获取对应的 `depsMap`, 没有就初始化
2. 获取对应的 `dep`, 没有就初始化
3. 将当前的 `effect` 保存进 `dep`

```typescript
export function track(target: object, type: TrackOpTypes, key: unknown) {
  if (shouldTrack && activeEffect) {
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()));
    }
    let dep = depsMap.get(key);
    if (!dep) {
      depsMap.set(key, (dep = createDep()));
    }
    /** */
    trackEffects(dep, eventInfo);
  }
}

export function trackEffects(
  dep: Dep,
  debuggerEventExtraInfo?: DebuggerEventExtraInfo,
) {
  let shouldTrack = false;
  if (effectTrackDepth <= maxMarkerBits) {
    if (!newTracked(dep)) {
      dep.n |= trackOpBit;
      shouldTrack = !wasTracked(dep);
    }
  } else {
    shouldTrack = !dep.has(activeEffect!);
  }

  if (shouldTrack) {
    dep.add(activeEffect!);
    activeEffect!.deps.push(dep);
    /** */
  }
}
```

还有细节上的东西, 比如:

- 触发了 `track` 但是此时是不应该接着走的, 比如我们就 简单的打印了下 `console.log(state.name)` 是不是不应该收集的
- 然后就是 `避免重复收集`

此外我们还发现, `activeEffect` 还把 当前的 `dep` 收集进了 `deps`, 这是为啥?

这里我举个例子:

```typescript
const base = {
  ok: true,
  text: 'hello decade',
};
const state = reactive(base);

watchEffect(() => {
  document.body.innerText = state.ok ? state.text : 'hello zio';
});
```

此时的对应关系应该是这样的:

```typescript
const depsMap = targetMap.get(base);
const depOk = depsMap.get('ok'); // 里面保存着上面的 watcheEffect
const depText = depsMap.get('text'); //  里面保存着上面的 watcheEffect
```

但是当我们将 `state.ok = false`, 我们期望的对应关系应该是:

```typescript
const depsMap = targetMap.get(base);
const depOk = depsMap.get('ok'); // 里面保存着上面的 watcheEffect
```

但是实际上的还是之前的 对应关系, 这是为啥, 因为没有对应关系, 我们能从 `activeEffect` 找到那个没有用的 `dep` 嘛? 答案是不能,
所以我们需要 `activeEffect!.deps.push(dep);` 建立联系

---

# trigger
