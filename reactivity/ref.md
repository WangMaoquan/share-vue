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
