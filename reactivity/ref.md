---
marp: true
---

# ref

作为 `vue3.x` 中 两个 `响应式化` 我们的数据的 `api` 之一, 可谓是相当重要的存在, 接下来我们简单的深入一下

---

## createRef

```typescript
function createRef(rawValue: unknown, shallow: boolean) {
  if (isRef(rawValue)) {
    return rawValue;
  }
  return new RefImpl(rawValue, shallow);
}
```

主要做的就是 判断创建来的是不是 `ref`, 是就直接返回, 不是就调用 `new RefImpl`, 所以我们看看 `RefImpl` 这个类

---

### RefImpl

```typescript
class RefImpl<T> {
  private _value: T;
  private _rawValue: T;

  public dep?: Dep = undefined;
  public readonly __v_isRef = true;

  constructor(value: T, public readonly __v_isShallow: boolean) {
    this._rawValue = __v_isShallow ? value : toRaw(value);
    this._value = __v_isShallow ? value : toReactive(value);
  }

  get value() {
    trackRefValue(this);
    return this._value;
  }

  set value(newVal) {
    const useDirectValue =
      this.__v_isShallow || isShallow(newVal) || isReadonly(newVal);
    newVal = useDirectValue ? newVal : toRaw(newVal);
    if (hasChanged(newVal, this._rawValue)) {
      this._rawValue = newVal;
      this._value = useDirectValue ? newVal : toReactive(newVal);
      triggerRefValue(this, newVal);
    }
  }
}
```

代码不复杂, 有这么几个字段

1. `_value`: 保存 `响应式处理` 后的值, 这里的处理指如果传入的是一个 `Object/Array/Map/Set` 这样的就会用 `reactive`处理, 否则就是原本的值
2. `_rawValue`: 既然存在可能被处理的情况, 所以就需要有个字段保存 `原本的值`
3. `dep`: 保存依赖的地方, 因为 `Ref` 没有像 `Object/Array/Map/Set` 那样有个 `map` 去保存依赖, 而且 `Ref` 其实就只会在 访问和修改 `.value` 的才会去 收集和派发, 不存在 `key` 很多的情况, 能保证当前 `Ref` 与 所收集的 `effect` 是对应的
4. `__v_isRef`: 判断是否是 `Ref` 的标志
5. `value`: 使用的是 `访问器`, 即 `getter/setter` 在这俩里面实现 `依赖收集` 与 `派发更新`

这里补充一个知识点: 我们都知道 `TypeScript` 是 鸭子类型(duck typing) 即长得像就是一个类型, 可以参考这个 [issues](https://github.com/vuejs/core/issues/1111)

```typescript
const state = reactive({
  foo: {
    value: 1,
    label: 'bar',
  },
});

console.log(state.foo.label); // Property 'label' does not exist on type 'number'
```

这里导致的原因, 是因为 把 `foo` 当做了 `ref`, 所以为了避免这个

```typescript
declare const isRefSymbol: unique symbol;
export interface Ref<T = any> {
  [isRefSymbol]: true;
  /**
   * @internal
   */
  __v_isRef: true;

  value: T;
}
```

加上一个 `唯一key` 就能就解决嘞

---

## customRef

创建一个自定义 `ref`, `显式` 控制其依赖跟踪和更新触发

什么叫`显示`, 就是控制权暴露给用户, 其实就是 暴露出 `track`, `trigger`, 怎么暴露呢? 作为函数的 `参数` 传入就好了, 类比下 `new Promise((resolve, reject) => {})` 的 `resolve, reject`

```typescript
export function customRef<T>(factory: CustomRefFactory<T>): Ref<T> {
  return new CustomRefImpl(factory) as any;
}
```

接受一个 `工厂函数`, 返回 实现自定义的 `getter/setter` 的一个对象

---

### CustomRefImpl

```typescript
class CustomRefImpl<T> {
  public dep?: Dep = undefined;

  private readonly _get: ReturnType<CustomRefFactory<T>>['get'];
  private readonly _set: ReturnType<CustomRefFactory<T>>['set'];

  public readonly __v_isRef = true;

  constructor(factory: CustomRefFactory<T>) {
    const { get, set } = factory(
      () => trackRefValue(this),
      () => triggerRefValue(this),
    );
    this._get = get;
    this._set = set;
  }

  get value() {
    return this._get();
  }

  set value(newVal) {
    this._set(newVal);
  }
}
```

`customRef` 肯定也是一个 `Ref`, 所以 `dep, _v_isRef` 都会有的, 生成实例的时候, 构造函数会把 `track, trigger` 传给我们的 `factory` 达到目的

---

## toRef, toRefs

这个两个方法也用到的多, 最开始版本没有 `script setup` 这个语法的时候, 使用 `compositionApi` 都是通过 `setup` 返回一个对象, 但是当我们定义的有 `const state = reactive({}); const count = ref(1) ...` 最后返回的时候, 我们不需要在模板里面使用 `state.xx` 而是直接使用`xx` 的时候就会用到 `toRefs`, 为啥要使用很简单是因为结构 `state` 会导致 `响应式丢失`

### toRef

看名字其实很容易理解, 转换成 `Ref`, 怎么来转换? 也就是我们 访问 `.value` 的 需要访问到 我们转成 `Ref` 之前的那个, 之前提过的 `CustomRef` 给 `value` 设置的访问器 `return this._get()`, 是不是就很清楚了

```typescript
export function toRef<T>(
  value: T,
): T extends () => infer R
  ? Readonly<Ref<R>>
  : T extends Ref
  ? T
  : Ref<UnwrapRef<T>>;
export function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K,
): ToRef<T[K]>;
export function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K,
  defaultValue: T[K],
): ToRef<Exclude<T[K], undefined>>;
export function toRef(
  source: Record<string, any> | MaybeRef,
  key?: string,
  defaultValue?: unknown,
): Ref {
  if (isRef(source)) {
    return source;
  } else if (isFunction(source)) {
    return new GetterRefImpl(source) as any;
  } else if (isObject(source) && arguments.length > 1) {
    return propertyToRef(source, key!, defaultValue);
  } else {
    return ref(source);
  }
}
```

接受参数是 `Ref`, `function`, `object` 和 `基础类型`,

下面我们看看实现

---

#### GetterRefImpl

```typescript
class GetterRefImpl<T> {
  public readonly __v_isRef = true;
  public readonly __v_isReadonly = true;
  constructor(private readonly _getter: () => T) {}
  get value() {
    return this._getter();
  }
}
```

---

#### propertyToRef

```typescript
function propertyToRef(
  source: Record<string, any>,
  key: string,
  defaultValue?: unknown,
) {
  const val = source[key];
  return isRef(val)
    ? val
    : (new ObjectRefImpl(source, key, defaultValue) as any);
}
```

---

#### ObjectRefImpl

```typescript
class ObjectRefImpl<T extends object, K extends keyof T> {
  public readonly __v_isRef = true;

  constructor(
    private readonly _object: T,
    private readonly _key: K,
    private readonly _defaultValue?: T[K],
  ) {}

  get value() {
    const val = this._object[this._key];
    return val === undefined ? this._defaultValue! : val;
  }

  set value(newVal) {
    this._object[this._key] = newVal;
  }

  get dep(): Dep | undefined {
    return getDepFromReactive(toRaw(this._object), this._key);
  }
}
```

主要说说 `ObjectRefImpl`, 首先传入的 `object` 肯定是 响应式的, 所以在 获取`value`的时候, 会触发 `object.key`, 这样也就被收集依赖了,

设置值的时候同理, `toRefs` 其实就这么实现的

---

### toRefs

```typescript
export function toRefs<T extends object>(object: T): ToRefs<T> {
  if (__DEV__ && !isProxy(object)) {
    console.warn(
      `toRefs() expects a reactive object but received a plain one.`,
    );
  }
  const ret: any = isArray(object) ? new Array(object.length) : {};
  for (const key in object) {
    ret[key] = propertyToRef(object, key);
  }
  return ret;
}
```

`toRefs` 返回的一个全新的对象, 且 `key` 与 原响应式的对象的 `key` 保持一直, 值变成了 `Ref`, 所以能进行解构

是不是还有个问题, 结构出来的是 `Ref` 但是我们再模板里面使用, 却没有过 `.value`

这是因为处理过了, 实现的方法叫做 `proxyRefs`

---
