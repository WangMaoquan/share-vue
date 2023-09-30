---
marp: true
---

# reactive

作为 `vue3.x` 中 两个 `响应式化` 我们的数据的 `api` 之一, 可谓是相当重要的存在, 接下来我们简单的深入一下

---

## createReactiveObject

不论 `reactive`, `readonly`, `shallowReactive`, `shallowReadonly`, 其实本质都是都是调用的 `createReactiveObject` 这个方法, 我们也都知道, `reactive` 返回的是一个 `Proxy`, 所以主要的逻辑 其实就是 `return new Proxy(target, handler)`

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

Proxy 最主要的逻辑就是 `handler` 即 第二个参数, 也就是上面的 `collectionHandlers` 和 `baseHanlders`, 前者主要处理的 `Map/Set` 这样的集合, 后者处理的就是我们的 `Object/Array`

---

### baseHanlders

`Proxy` 的 `handler` 有十三种拦截方法, 这里用到的主要有 `get`, `set`, `has`, `delete`, `ownKeys`, 具体用法参照 [Proxy-MDN](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy)

#### get

`get()` 方法用于拦截对象的 `读取属性操作`, 通俗一点就是 `obj.xxx`, `obj["xxx"]` 当然还包括 `原型链`

```typescript
function get(target: Target, key: string | symbol, receiver: object) {
  const isReadonly = this._isReadonly,
    shallow = this._shallow;
  if (key === ReactiveFlags.IS_REACTIVE) {
    return !isReadonly;
  } else if (key === ReactiveFlags.IS_READONLY) {
    return isReadonly;
  } else if (key === ReactiveFlags.IS_SHALLOW) {
    return shallow;
  } else if (
    key === ReactiveFlags.RAW &&
    receiver ===
      (isReadonly
        ? shallow
          ? shallowReadonlyMap
          : readonlyMap
        : shallow
        ? shallowReactiveMap
        : reactiveMap
      ).get(target)
  ) {
    return target;
  }

  const targetIsArray = isArray(target);

  if (!isReadonly) {
    if (targetIsArray && hasOwn(arrayInstrumentations, key)) {
      return Reflect.get(arrayInstrumentations, key, receiver);
    }
    if (key === 'hasOwnProperty') {
      return hasOwnProperty;
    }
  }

  const res = Reflect.get(target, key, receiver);

  if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
    return res;
  }

  if (!isReadonly) {
    track(target, TrackOpTypes.GET, key);
  }

  if (shallow) {
    return res;
  }

  if (isRef(res)) {
    return targetIsArray && isIntegerKey(key) ? res : res.value;
  }

  if (isObject(res)) {
    return isReadonly ? readonly(res) : reactive(res);
  }

  return res;
}
```

代码逻辑不复杂, 主要做的就是

1. 处理 `vue3.x`自定义的 `ReactiveFlag`
2. 处理 `Array` 的几个方法,
3. 处理 `内置的Symbol` 和 `vue3.x` 中定义的 不需要被收集的 `key`
4. 收集依赖
5. 处理 `shallow`
6. 处理返回值是 `ref` / `object` 的情况
7. 默认返回

---

##### 处理数组的几个方法

这处理的几个方法中可以分为两类:

- 数组自身发生改变: 数组改变什么最明显? 答案是`长度`, 所以哪几个方法会导致数组长度发生改变呢? `push`, `pop`, `shift`, `unshift`, `unshift`, `splice`
- 数组查找: `indexOf`, `lastIndexOf`, `includes`

想一想: 为啥要分去处理这几个方法, 看下面的例子你就会明白了

```typescript
const arr = reactive([1, 2, 3, 4, 5]);

// 直接监听 length
watch(
  () => arr.length,
  () => console.log(arr, 'watch-length'),
);

// 监听指定key
watch(
  () => arr[0],
  () => console.log(arr, 'watch-key'),
);

// 遍历
watchEffect(() => {
  for (let i in arr) {
    console.log(i, 'for-in');
  }
});

const findObj = {
  name: 'decade',
};

arr.push(6);
arr.push(findObj);
arr.shift();

arr.indexOf(findObj);
arr.lastIndexOf(findObj);
arr.includes(findObj);
```

---

下面我们去看看 怎么处理的

```typescript
function createArrayInstrumentations() {
  const instrumentations: Record<string, Function> = {};
  (['includes', 'indexOf', 'lastIndexOf'] as const).forEach((key) => {
    instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
      const arr = toRaw(this) as any;
      for (let i = 0, l = this.length; i < l; i++) {
        track(arr, TrackOpTypes.GET, i + '');
      }
      const res = arr[key](...args);
      if (res === -1 || res === false) {
        return arr[key](...args.map(toRaw));
      } else {
        return res;
      }
    };
  });
  (['push', 'pop', 'shift', 'unshift', 'splice'] as const).forEach((key) => {
    instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
      pauseTracking();
      const res = (toRaw(this) as any)[key].apply(this, args);
      resetTracking();
      return res;
    };
  });
  return instrumentations;
}
```

代码其实还是很清晰,

- 处理 `查找`:
  1. 获取最初的 数组
  2. 使用最初的数组调用 拿到查找方法的返回值, 现在是要么找到要么没找到, 没找到是不是还有种情况就是我们的 `arg` 也是被包装过的
     1. 找到了就直接返回
     2. 没找到需要我们尝试 `toRaw(args)`, 然后返回
- 处理 `改变自身`:
  1. 暂停依赖收集, 防止爆栈
  2. 使用 `apply` 调用方法
  3. 恢复依赖收集

---

#### set

`set()` 方法是设置属性值操作的捕获器, 通俗一点就是 `obj.xxx = xxx`, `obj["xxx"] = xxx`

```typescript
function set(
  target: object,
  key: string | symbol,
  value: unknown,
  receiver: object,
): boolean {
  let oldValue = (target as any)[key];
  if (isReadonly(oldValue) && isRef(oldValue) && !isRef(value)) {
    return false;
  }
  if (!this._shallow) {
    if (!isShallow(value) && !isReadonly(value)) {
      oldValue = toRaw(oldValue);
      value = toRaw(value);
    }
    if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
      oldValue.value = value;
      return true;
    }
  }
  const hadKey =
    isArray(target) && isIntegerKey(key)
      ? Number(key) < target.length
      : hasOwn(target, key);
  const result = Reflect.set(target, key, value, receiver);
  if (target === toRaw(receiver)) {
    if (!hadKey) {
      trigger(target, TriggerOpTypes.ADD, key, value);
    } else if (hasChanged(value, oldValue)) {
      trigger(target, TriggerOpTypes.SET, key, value, oldValue);
    }
  }
  return result;
}
```

主要的做的事

1. 处理 旧值是`readonly ref`
2. toRaw 处理新值, 旧值
3. 处理 `非数组`中 旧值是 `ref` 新值不是 `ref`
4. 处理 只有自身的 `key` 对应的 `value`, 才会去 派发更新

---
