---
marp: true
---

# computed

`computed` 计算属性, 主打一个 `缓存`, 即 传入的 `getter` 执行后返回的值不变, 就不需要重新再去执行这个 `getter`, 这里有几个关键词

1. 值不变. 是不是需要有一个标记让我们知道值变了, 这种通知值变了然后做啥, 是不是很像 `trigger`, 也就是 getter 中的响应式对象 将 `computed` 当做依赖收集了
2. 重新执行 `getter`, 也就是发现了 值变了(标记变了)我们才会重新执行 `getter`

`computed` 接受的参数:

1. 接受一个 自定义的 `getter方法`, 一个 `debugOptions` 调试配置
2. 接受一个 对象且实现了 `get/set` 方法, 一个 `debugOptions` 调试配置

一般我们用的最多的就是第一种

```typescript
export function computed<T>(
  getter: ComputedGetter<T>,
  debugOptions?: DebuggerOptions,
): ComputedRef<T>;
export function computed<T>(
  options: WritableComputedOptions<T>,
  debugOptions?: DebuggerOptions,
): WritableComputedRef<T>;
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>,
  debugOptions?: DebuggerOptions,
  isSSR = false,
) {
  let getter: ComputedGetter<T>;
  let setter: ComputedSetter<T>;
  const onlyGetter = isFunction(getterOrOptions);
  if (onlyGetter) {
    getter = getterOrOptions;
    setter = __DEV__
      ? () => {
          console.warn('Write operation failed: computed value is readonly');
        }
      : NOOP;
  } else {
    getter = getterOrOptions.get;
    setter = getterOrOptions.set;
  }
  const cRef = new ComputedRefImpl(
    getter,
    setter,
    onlyGetter || !setter,
    isSSR,
  );
  /** */
  return cRef as any;
}
```

主要做的就是将传参处理成`ComputedRefImpl` 的参数, 所以我们主要看看 `ComputedRefImpl`

---

## ComputedRefImpl

`ComputedRefImpl` 从名字看就知道 也是一个 `Ref`, 加上参数有 `getter/setter` 我们是不是可以想到 `toRef` 传入的 `getter`, 下面我们进入代码:

```typescript
export class ComputedRefImpl<T> {
  public dep?: Dep = undefined;

  private _value!: T;
  public readonly effect: ReactiveEffect<T>;

  public readonly __v_isRef = true;
  public readonly [ReactiveFlags.IS_READONLY]: boolean = false;

  public _dirty = true;
  public _cacheable: boolean;

  constructor(
    getter: ComputedGetter<T>,
    private readonly _setter: ComputedSetter<T>,
    isReadonly: boolean,
    isSSR: boolean,
  ) {
    this.effect = new ReactiveEffect(getter, () => {
      if (!this._dirty) {
        this._dirty = true;
        triggerRefValue(this);
      }
    });
    this.effect.computed = this;
    this.effect.active = this._cacheable = !isSSR;
    this[ReactiveFlags.IS_READONLY] = isReadonly;
  }
  get value() {
    const self = toRaw(this);
    trackRefValue(self);
    if (self._dirty || !self._cacheable) {
      self._dirty = false;
      self._value = self.effect.run()!;
    }
    return self._value;
  }
  set value(newValue: T) {
    this._setter(newValue);
  }
}
```

现在我们知道了 标记是 `_dirty`, 然后通过 `ReactiveEffect` 的第二个参数 `scheduler` 来控制 `_dirty` 的修改, 以及 派发更新

当我们获取 `.value` 时, 我们触发了 `computed` 的 `get`,
收集用到了`computed`的依赖
修改 `_dirty` 并执行 `effect.run(getter)` , 这时触发`trigger` 将 `computed` 作为 依赖收集进 `dep`

缓存的关键就是 只要 `getter` 中的 响应式对象不变, `_dirty` 就永远不会变成`true`
