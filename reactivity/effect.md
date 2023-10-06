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

# ReactiveEffect

接下来就开始我们的 `ReactiveEffect`, 其实 `dep` 里面存放的就是 `ReactiveEffect`, 我们通过上面的代码, 已经大概知道 `ReactiveEffect` 上有哪些方法, 比如 `scheduler`, `run`, 有哪些属性 `computed`, `allowRecurse`, 下面我们正式进入

```typescript
export class ReactiveEffect<T = any> {
  active = true;
  deps: Dep[] = [];
  parent: ReactiveEffect | undefined = undefined;
  computed?: ComputedRefImpl<T>;
  allowRecurse?: boolean;
  private deferStop?: boolean;
  onStop?: () => void;
  onTrack?: (event: DebuggerEvent) => void;
  onTrigger?: (event: DebuggerEvent) => void;
  constructor(
    public fn: () => T,
    public scheduler: EffectScheduler | null = null,
    scope?: EffectScope,
  ) {
    recordEffectScope(this, scope);
  }
  run() {
    /** */
  }
  stop() {
    /** */
  }
}
```

**属性**

- `active`: 当前 `effect` 是否激活
- `deps`: 存放着 当前 `effect` 收集过的 `dep`
- `parent`: 处理 嵌套 `effect` 保存之前的 `activeEffect`
- `computed` 存放 `computedRef`
- `allowRecurse`: 是否允许递归
- `deferStop`: 是否延迟停止
- `fn`: 简单的理解就是我们传入的那个回调
- `scheduler`: 调度方法, 存在时会优先执行

**方法**

- `onStop`: 触发 `stop` 后执行的方法
- `onTrack`: 开发环境下触发 `track` 会执行的回调
- `onTrigger`: 开发环境下触发 `trigger` 会执行的回调
- `run`: 简单来说就是执行我们传入的 `fn`
- `stop`: 是当前 `effect` 停止, 就是将 `active = false`

属性方法介绍了一遍, 我们看看 `run`, `stop` 的实现

---

## run

`run` 最主要干得就是 执行 `fn`, 中间还有些别的处理, 比如处理 `嵌套effect` 会给 `parent` 赋值, 之前不是提过清除 `不需要的依赖` 嘛, 当然也是在这里执行

```typescript
class ReactiveEffect {
  run() {
    if (!this.active) {
      return this.fn();
    }
    let parent: ReactiveEffect | undefined = activeEffect;
    let lastShouldTrack = shouldTrack;
    while (parent) {
      if (parent === this) {
        return;
      }
      parent = parent.parent;
    }
    try {
      this.parent = activeEffect;
      activeEffect = this;
      shouldTrack = true;

      trackOpBit = 1 << ++effectTrackDepth;

      if (effectTrackDepth <= maxMarkerBits) {
        initDepMarkers(this);
      } else {
        cleanupEffect(this);
      }
      return this.fn();
    } finally {
      if (effectTrackDepth <= maxMarkerBits) {
        finalizeDepMarkers(this);
      }

      trackOpBit = 1 << --effectTrackDepth;

      activeEffect = this.parent;
      shouldTrack = lastShouldTrack;
      this.parent = undefined;

      if (this.deferStop) {
        this.stop();
      }
    }
  }
}
```

主要的逻辑是, 修改 `activeEffect` , 然后执行 `fn`, `try`中赋值用到的变量 `catch` 中重置, 我们之前说的清除依赖, 应该是 `cleanupEffect` 或者 `finalizeDepMarkers`, 我们先看 `cleanupEffect`

### cleanupEffect

```typescript
function cleanupEffect(effect: ReactiveEffect) {
  const { deps } = effect;
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      deps[i].delete(effect);
    }
    deps.length = 0;
  }
}
```

这个方法我们发现 清空自己的 `deps` 的同时, 还让之前 保存着当前 `effect` 的 `dep` 删除当前 `effect`, 相当于断开所有, 一般也会执行到这个方法, 这个只有在 嵌套层级的深度超过了 `maxMarkerBits` 才会执行

---

### finalizeDepMarkers

```typescript
export const finalizeDepMarkers = (effect: ReactiveEffect) => {
  const { deps } = effect;
  if (deps.length) {
    let ptr = 0;
    for (let i = 0; i < deps.length; i++) {
      const dep = deps[i];
      if (wasTracked(dep) && !newTracked(dep)) {
        dep.delete(effect);
      } else {
        deps[ptr++] = dep;
      }
      dep.w &= ~trackOpBit;
      dep.n &= ~trackOpBit;
    }
    deps.length = ptr;
  }
};
```

`dep.w &= ~trackOpBit` 这个操作其实归零(重置), 举个例子就是这样: `0 | 4 & ~4`

首先 `dep` 是 `key` 对应的 `effect` 的 `Set` 集合, `dep.delete(effect);` 那么这行代码就是清除 `无用的 effect`, 看它的判断条件
满足 `wasTracked` 和不满足 `newTracked`, 下面我们去看这两个方法

#### wasTracked, newTracked

```typescript
export const wasTracked = (dep: Dep): boolean => (dep.w & trackOpBit) > 0;
export const newTracked = (dep: Dep): boolean => (dep.n & trackOpBit) > 0;
```

`dep` 上的 `n` 和 `w` 分别与 `trackOpBit` 按位与(&), 只要 `同位为 1`,那么结果就不会为 0, 看见 `trackOpBit`, 我们是不是想起来在 `track` 的时候是不是有过看下面代码:

```typescript
export function trackEffects(
  dep: Dep,
  debuggerEventExtraInfo?: DebuggerEventExtraInfo,
) {
  if (effectTrackDepth <= maxMarkerBits) {
    if (!newTracked(dep)) {
      dep.n |= trackOpBit;
      shouldTrack = !wasTracked(dep);
    }
  }
  /** */
}
```

是不是只要触发了 `收集依赖` 就会让 `dep.n` 与 `trackOpBit` 执行按位或, 这样是不是就保证了 `newTracked` 一定是 `true`, 那么 `dep.w` 是哪里处理的呢? 记不记得 `finalizeDepMarkers` 之前还有个 `initDepMarkers`, 答案就是 它了

#### initDepMarkers

```typescript
export const initDepMarkers = ({ deps }: ReactiveEffect) => {
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      deps[i].w |= trackOpBit;
    }
  }
};
```

这里就让 `dep.w` 与 `trackOpBit` 按位或了, 这样也就保证了 `wasTracked` 为 `true`

---

## stop

```typescript
class ReactiveEffect {
  stop() {
    if (activeEffect === this) {
      this.deferStop = true;
    } else if (this.active) {
      cleanupEffect(this);
      if (this.onStop) {
        this.onStop();
      }
      this.active = false;
    }
  }
}
```

`deferStop` 也就只有在 自己 `stop` 自己的时候才会赋值, 我们看下面的例子

```typescript
const c = ref(true);
const runner = effect(() => {
  if (!c.value) {
    stop(runner);
  }
});
c.value = !c.value;
```

因为 没有将 `w,n` 复原, 也就是没有执行 `finalizeDepMarkers`, 比如下面这个例子

`c` 中的 `dep` 存放的是不是 `runnerEffect`, 然后我们执行 `修改` 的操作, 是不是会执行我们注册的回调, 然后会给这个 `dep.w` 与 `trackOpBit` 执行 `按位与`, 然后再执行到 `if(!c.value)` 读取, 这时候是不是会 让 `dep.n` 与 `trackOpBit` 执行 `按位与`
然后我们执行到了 `stop`

```typescript
export function stop(runner: ReactiveEffectRunner) {
  runner.effect.stop();
}
```

我们可以看出来其实就是执行的 `effect.stop`, 如果没有 `this === activeEffect`, 我们就会执行 `cleanupEffect`, 但是这个方法是不会让 `dep` 的 `w,n` 复原, 没有复原下次再触发 `w,n`的对应的层级其实就变了, `trackOpBit` 还能代表嵌套的层级
同时我们还注意到 此时 `run` 其实还没执行完(finally 还未), 所以我们需要 `deferStop`, 即在 `finally` 执行 `stop`

---

## effect

---

# 总结

1. `targetMap` 中 保存着 `target` 与 `depsMap` 的依赖关系, `depsMap` 中保存着 `key` 与 `dep` 的关系, `dep` 是存放 `effect` 的 `Set集合`, 上面还有两个属性一个 `n` 和 `w` 分别代表 新收集的 和 已经收集过的
2. `ReactiveEffect` 的 `run` 方法通过使用 `this.parent` 实现 `嵌套`, 通过 `initDepMarkers` 修改 `dep.w`, 然后配合 `track` 中 会修改 `dep.n`, 最后通过 `finalizeDepMarkers` 达到 清除多余 `effect` 的功能
3. `按位与(&)`: 相同位为 1 才为 1; `按位与(|)`: 有 1 就是 1; `n | bit &= ~bit`: 重置操作
