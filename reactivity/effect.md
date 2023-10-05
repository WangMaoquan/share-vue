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

那么 `trigger` 是 `怎么去取`, 取还记得我们 `TriggerOpTypes` 这个 枚举嘛? 还有我们的 自定义的 `ITERATE_KEY`, `MAP_KEY_ITERATE_KEY`嘛, 就根据这些来取出我们的 `dep`

```typescript
export function trigger(
  target: object,
  type: TriggerOpTypes,
  key?: unknown,
  newValue?: unknown,
  oldValue?: unknown,
  oldTarget?: Map<unknown, unknown> | Set<unknown>,
) {
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    return;
  }
  let deps: (Dep | undefined)[] = [];
  if (type === TriggerOpTypes.CLEAR) {
    deps = [...depsMap.values()];
  } else if (key === 'length' && isArray(target)) {
    const newLength = Number(newValue);
    depsMap.forEach((dep, key) => {
      if (key === 'length' || key >= newLength) {
        deps.push(dep);
      }
    });
  } else {
    if (key !== void 0) {
      deps.push(depsMap.get(key));
    }
    switch (type) {
      case TriggerOpTypes.ADD:
        if (!isArray(target)) {
          deps.push(depsMap.get(ITERATE_KEY));
          if (isMap(target)) {
            deps.push(depsMap.get(MAP_KEY_ITERATE_KEY));
          }
        } else if (isIntegerKey(key)) {
          deps.push(depsMap.get('length'));
        }
        break;
      case TriggerOpTypes.DELETE:
        if (!isArray(target)) {
          deps.push(depsMap.get(ITERATE_KEY));
          if (isMap(target)) {
            deps.push(depsMap.get(MAP_KEY_ITERATE_KEY));
          }
        }
        break;
      case TriggerOpTypes.SET:
        if (isMap(target)) {
          deps.push(depsMap.get(ITERATE_KEY));
        }
        break;
    }
  }

  const eventInfo = __DEV__
    ? { target, type, key, newValue, oldValue, oldTarget }
    : undefined;

  if (deps.length === 1) {
    if (deps[0]) {
      if (__DEV__) {
        triggerEffects(deps[0], eventInfo);
      } else {
        triggerEffects(deps[0]);
      }
    }
  } else {
    const effects: ReactiveEffect[] = [];
    for (const dep of deps) {
      if (dep) {
        effects.push(...dep);
      }
    }
    if (__DEV__) {
      triggerEffects(createDep(effects), eventInfo);
    } else {
      triggerEffects(createDep(effects));
    }
  }
}
```

1. 获取 `depsMap`
2. 根据 `type, key` 获取 `deps`, 存放的 `dep` 的数组
   - 处理特殊
     1. 处理 `TriggerOpTypes.CLEAR`, 比如 `proxySet.clear()`
     2. 处理 `key` 为 `length` 且是数组, 比如直接修改`arr.length = 10`
   - 处理普通: 直接通过 `key` 获取对应的 `dep`, 这里还需要加上对应操作 `TriggerOpTypes` 所收集的 `dep`, 这样才是全部的
3. 触发 `dep` 里面的 `effect`

---

## triggerEffects

```typescript
export function triggerEffects(
  dep: Dep | ReactiveEffect[],
  debuggerEventExtraInfo?: DebuggerEventExtraInfo,
) {
  const effects = isArray(dep) ? dep : [...dep];
  for (const effect of effects) {
    if (effect.computed) {
      triggerEffect(effect, debuggerEventExtraInfo);
    }
  }
  for (const effect of effects) {
    if (!effect.computed) {
      triggerEffect(effect, debuggerEventExtraInfo);
    }
  }
}

function triggerEffect(
  effect: ReactiveEffect,
  debuggerEventExtraInfo?: DebuggerEventExtraInfo,
) {
  if (effect !== activeEffect || effect.allowRecurse) {
    /** */
    if (effect.scheduler) {
      effect.scheduler();
    } else {
      effect.run();
    }
  }
}
```

`triggerEffects` 主要做的就是两件事

1. 转换成数组
2. 遍历执行, 有限执行 `computed`, 再执行普通的

`triggerEffect`

1. 判断 执行的 `effect` 不是当前的 `activeEffect` 或者 当前的 `effect` 是允许递归的
2. 优先执行 `scheduler` 否则执行 `run`

---

