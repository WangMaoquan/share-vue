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

1. 处理 旧值是`readonly ref` 详细 [pr](https://github.com/vuejs/core/pull/5048)
2. toRaw 处理新值, 旧值
3. 处理 `非数组`中 旧值是 `ref` 新值不是 `ref`
4. 处理 派发更新

---

或许有一个疑问 `target === toRaw(receiver)` 这行代码是干啥的?

下面我通过一个例子来就会明白嘞

```javascript
const reactive = (target) => {
  return new Proxy(target, {
    get(target, key, receiver) {
      if (key === 'name') {
        console.log(key, 'key');
      }
      return Reflect.get(target, key, receiver);
    },
    set(target, key, value, receiver) {
      console.log('target', target);
      console.log('receiver', receiver);
      return Reflect.set(target, key, value);
    },
  });
};
const obj = {};
const child = reactive(obj);
const proto = { name: 'decade' };
const parent = reactive(proto);
Object.setPrototypeOf(child, parent);
child.name; // 打印两次 name key
child.name = 'zio'; // 这个也会打印两次 target, receiver
```

为啥 `child.name` 会触发原型的 `get`, 同理 `child.name = 'zio'` 为啥也会触发原型的 `set`, 现在是不是有点眉目 为啥要加判断,
就是为了 `屏蔽` 原型, 我们仔细看 `receiver` 两次打印的其实都是 `child` 而 `child` 的 源对象就是我们的 `obj`, 所以 `target === toRaw(receiver)` 能屏蔽 `原型`, 可以理解为减少不必要的 `依赖收集`

---

#### has

`has()` 方法是针对 `in` 操作符的代理方法

```typescript
function has(target: object, key: string | symbol): boolean {
  const result = Reflect.has(target, key);
  if (!isSymbol(key) || !builtInSymbols.has(key)) {
    track(target, TrackOpTypes.HAS, key);
  }
  return result;
}
```

主要的就是 判断 `key` 是否需要被 `收集`

---

#### deleteProperty

`deleteProperty()` 方法用于拦截对对象属性的 delete 操作

```typescript
function deleteProperty(target: object, key: string | symbol): boolean {
  const hadKey = hasOwn(target, key);
  const oldValue = (target as any)[key];
  const result = Reflect.deleteProperty(target, key);
  if (result && hadKey) {
    trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue);
  }
  return result;
}
```

主要做的就是 判断 `key` 是否应该 派发更新

---

#### ownKeys

`ownKeys()` 方法用于拦截 Reflect.ownKeys(), 这是 `mdn` 的介绍, 是不是感觉比前面几个的介绍更加的 `笼统`, 然后我切换成 `英文`

The `handler.ownKeys()` method is a trap for the `[[OwnPropertyKeys]]` object internal method, which is used by operations such as `Object.keys()`, `Reflect.ownKeys()`, etc

可以看出拦截的方法有 `Object.keys`, 是获取 `keys` 的, `Object.getOwnPropertyNames`, `Object.getOwnPropertySymbols` 也是获取 `keys` 的, `for...in` 也是

```javascript
Object.keys(proxy);
for (let key in proxy) {
  console.log(key);
}
Object.getOwnPropertyNames(proxy);
Object.getOwnPropertySymbols(proxy);
```

**下面看实现**

```typescript
function ownKeys(target: object): (string | symbol)[] {
  track(target, TrackOpTypes.ITERATE, isArray(target) ? 'length' : ITERATE_KEY);
  return Reflect.ownKeys(target);
}
```

---

### collectionHandlers

我们思考一下? `Map/Set` 是怎么 `添加值/访问值` 的? `map.set/map.get`, `set.add | ps: Set 没有提供访问某一项的api` 是不是发现并不是像 `对象` 那样 `object.propertyName` 去访问, `object.propertyName = xxx` 去修改, 所以对于对象的 `访问/修改` 其实并不适用于 `Map/Set`

我们看下面的代码

```javascript
const proxyMap = new Proxy(new Map(), {
  get(target, key, receiver) {
    console.log('map-key', key);
    return Reflect.get(target, key, receiver);
  },
});
const proxySet = new Proxy(new Set(), {
  get(target, key, receiver) {
    console.log('set-key', key);
    return Reflect.get(target, key, receiver);
  },
});
proxyMap.set('key1', 'key1');
// map-key set
// Uncaught TypeError: Method Map.prototype.set called on incompatible receiver #<Map>
proxyMap.has('key1');
// map-key has
// Uncaught TypeError: Method Map.prototype.has called on incompatible receiver #<Map>
proxyMap.get('key1');
// map-key get
// Uncaught TypeError: Method Map.prototype.get called on incompatible receiver #<Map>
proxySet.add(1);
// set-key add
// reactive.html:156 Uncaught TypeError: Method Set.prototype.add called on incompatible receiver #<Set>
proxySet.delete(1);
// set-key delete
// reactive.html:156 Uncaught TypeError: Method Set.prototype.delete called on incompatible receiver #<Set>
```

我们能获取到对应的 `key`, 这是因为 `.`, 然后有一个报错, 关键词 `called on incompatible receiver`, 意思是在不兼容的 `receiver` 上调用, 这里的 `receiver` 其实就是我们的 `proxy`, 为啥会有这么一个报错? 我瞅了瞅了 [ECMAScript 规范](https://tc39.es/ecma262/multipage/keyed-collections.html#sec-set-objects) 中有这么一句话 `Subclass constructors that intend to inherit the specified Set behaviour must include a super call to the Set constructor to create and initialize the subclass instance with the internal state necessary to support the Set(Map).prototype built-in methods` 大概意思就是只有 `Set/Map` 或者 `SubSet/SubMap` 才能调用 `Set/Map` 原型链上的内置的方法. 所以上面的例子我们可以改改

```javascript
class MySet extends Set {
  constructor() {
    super();
  }
  add(v) {
    console.log(v);
    // super.add(v)
    return this;
  }
  get size() {
    return 1;
  }
}
const proxySet = new Proxy(new MySet(), {
  get(target, key, receiver) {
    console.log('set-key', key);
    return Reflect.get(target, key, receiver);
  },
});
proxySet.add(1); // 执行 add 中的 console
proxySet.size; // 打印 1
```

现在我们直接执行方法已经没有报错了, 但是现在有个问题, 我们这么做并没有将值添加进 我们的集合中, 所以我们需要在方法里面调用 `super.add`
然后你会发现报错了, 还是同样的错误 `Uncaught TypeError: Method Set.prototype.add called on incompatible receiver #<MySet>`
相信到这里你也许就会知道为啥会报错了, 因为 `add(v)` 这个方法里面的 `this` 指向的其实是 `recevier(proxy)`, 但是我们现在比直接的 `proxy.add` 已经在执行可以不报错(不执行 super)
其实解决的方法很简单我们直接 `target.add(v)` 不就好了嘛, 下面我加点代码

```javascript
class MySet extends Set {
  add(v) {
    const target = this.raw;
    console.log(target);
    /** */
  }
}
const proxySet = new Proxy(new MySet(), {
  get(target, key, receiver) {
    if (key === 'raw') {
      return target;
    }
    /** */
  },
});
```

现在我们能拿到 `target` 了,但是由于我们的 `SupSet`, 自己实现了 `add` 方法, 所以是不会调用 `Set.prototype.add` 的, 我们要怎么解决这个问题, 其实也很简单, 换成普通对象, 普通对象里面有 `Map/Set` 的方法就行, 下面我们再重构

```javascript
const mutableInstrumentations = {
  add(v) {
    const target = this.raw;
    target.add(v);
  },
  get size() {
    const target = this.raw;
    return target.size;
  },
  keys() {
    const target = this.raw;
    return target.keys();
  },
};

const proxySet = new Proxy(new Set(), {
  get(target, key, receiver) {
    if (key === 'raw') {
      return target;
    }
    console.log('set-key', key);
    return Reflect.get(mutableInstrumentations, key, receiver);
  },
});
proxySet.add(1);
console.log(proxySet.size);
console.log(proxySet);
console.log(proxySet.keys());
```

好了现在就已经能正常工作了, 源码的实现也就是这样的一个实现

---

#### mutableCollectionHandlers

```typescript
export const mutableCollectionHandlers: ProxyHandler<CollectionTypes> = {
  get: /*#__PURE__*/ createInstrumentationGetter(false, false),
};
function createInstrumentationGetter(isReadonly: boolean, shallow: boolean) {
  const instrumentations = mutableInstrumentations;

  return (
    target: CollectionTypes,
    key: string | symbol,
    receiver: CollectionTypes,
  ) => {
    /** */
    if (key === ReactiveFlags.RAW) {
      return target;
    }
    return Reflect.get(
      hasOwn(instrumentations, key) && key in target
        ? instrumentations
        : target,
      key,
      receiver,
    );
  };
}
```

精简了一下代码嗷, 是不是觉得很眼熟, 我们就瞅瞅 `mutableInstrumentations`

```typescript
const mutableInstrumentations: Record<string, Function | number> = {
  get(this: MapTypes, key: unknown) {
    return get(this, key);
  },
  get size() {
    return size(this as unknown as IterableCollections);
  },
  has,
  add,
  set,
  delete: deleteEntry,
  clear,
  forEach: createForEach(false, false),
};
```

发现有 `Map/Set` 原型上所有的方法, 下面看看内部实现的

---

##### add

记住我们主要的思路 获取 `target` 然后调用 `add`

```typescript
function add(this: SetTypes, value: unknown) {
  value = toRaw(value);
  const target = toRaw(this);
  const proto = getProto(target);
  const hadKey = proto.has.call(target, value);
  if (!hadKey) {
    target.add(value);
    trigger(target, TriggerOpTypes.ADD, value, value);
  }
  return this;
}
```

现在是我们能够明确知道 新增的值 是否存在, 然后去 `派发更新`

---
