---
marp: false
paginate: true
theme: gaia
style: |
  section {
    padding: 20px 70px;
  }
---

<!--
_class: lead gaia
_paginate: false
-->

# Pinia

---

## 目录

![bg right w:400px constast](imgs/logo.svg)

- 什么是 Pinia
- 怎么使用 Pinia
- 简单深入一下 Pinia

---

### 什么是 Pinia

<style scoped>
section {
  font-size: 27px;
}
</style>

[Pinia](https://pinia.vuejs.org/)的官网有着这么一段描述: `Pinia The intuitive store for Vue.js` 大概意思就是一个针对 vue.js 的直观的状态管理, 抽取出关键词 `直观地`, `状态`, `vue.js`

- `直观`: 像写组件一样更熟悉, 比如 `defineComponent` => `defineStore`, `useXXX` => `useXxxStore`
- `状态`: 管理状态数据
- `vue.js`: 配合`vue.js`使用, 不管是 `2.x` 或者 `3.x`

与 `Vuex 3.x/4.x` 的比较:

- `mutations` 不再存在
- 无需创建自定义复杂包装器来支持 `TypeScript`, 所有内容都是类型化的
- 不再需要注入、导入函数、调用函数
- 无需动态添加 Store
- 不再有 `modules` 的嵌套结构
- 没有 `命名空间模块`

---

### 怎么使用 Pinia

安装:

```shell
pnpm install pinia -S
```

注册:

```typescript
import { createPinia } from 'pinia';
/** */
app.use(createPinia());
```

---

#### defineStore

<style scoped>
section {
  font-size: 26px;
}
</style>

只接受一个参数, 传入的是一个 `对象`

```typescript
import { defineStore } from 'pinia';

const useCounter = defineStore({
  id: 'counter',
  state: () => {
    return {
      count: 0,
    };
  },
  getters: {
    getDoubleCount() {
      return this.count * 2;
    },
  },
  actions: {
    addCount(num: number) {
      this.count += num;
    },
  },
});
```

---

<style scoped>
section {
  font-size: 30px;
}
</style>

接受两个参数, 第一个是 `store` 的 `id`, 第二个是 `对象`

```typescript
import { defineStore } from 'pinia';

const useCounter = defineStore('counter', {
  state: () => {
    return {
      count: 0,
    };
  },
  getters: {
    getDoubleCount() {
      return this.count * 2;
    },
  },
  actions: {
    addCount(num: number) {
      this.count += num;
    },
  },
});
```

---

接受两个参数, 第一个是 `store` 的 `id`, 第二个是 `方法`

```typescript
import { defineStore } from 'pinia';

const useCounter = defineStore('counter', () => {
  const count = ref(0);

  const getDoubleCount = computed(() => count.value * 2);

  const addCount = (num: number) => (count.value += num);

  return {
    count,
    getDoubleCount,
    addCount,
  };
});
```

---

#### 在 `.vue` 文件中使用

<style scoped>
section {
  font-size: 30px;
}
</style>

在 `setup` 中使用

```html
<script setup lang="ts">
  import { useCounter } from './useCounter';

  const counter = useCounter();

  const add = () => {
    const num = Math.floor(Math.random() * 100 - 50);
    counter.addCount(num);
  };
</script>

<template>
  <div>{{ counter.count }}</div>
  <button @click="add">add</button>
</template>
```

---

不在 `setup` 中使用

```html
<script lang="ts">
  import { mapState, mapActions } from 'pinia';
  import { useCounter } from './useCounter';

  export default {
    methods: {
      ...mapActions(useCounter, {
        myAddCount: 'addCount',
      }),
      add() {
        const num = Math.floor(Math.random() * 100 - 50);
        this.myAddCount(num);
      },
    },
    computed: {
      ...mapState(useCounter, {
        myCount: 'count',
      }),
    },
  };
</script>

<template>
  <div>{{ myCount }}</div>
  <button @click="add">add</button>
</template>
```

---

<style scoped>
section {
  font-size: 30px;
}
</style>

使用 `$reset` 重置

```typescript
import { useCounter } from './useCounter';

const counter = useCounter();

counter.$reset();
```

使用 `$dispatch` 批量修改

```typescript
// 传入的是对象
counter.$patch({
  count: counter.count + 1,
});

// 传入的方法
counter.$patch((state) => {
  state.count += 1;
});
```

---

### 简单深入 Pinia

[代码仓库](https://github.com/vuejs/pinia)

```shell
git clone https://github.com/vuejs/pinia.git

cd pinia

pnpm i
```

这样我们的代码就准备好了, 主要看的是 `packages/pinia` 这个包

---

<style scoped>
section {
  font-size: 21px;
}
</style>

#### createPinia

`createPinia` 使用的位置在 `app.use` 里面, 我们都知道 `use` 是用来注册 plugin 的, 需要的是一个`方法`或者一个对象且实现了 `install` 方法, 所以我们可以猜一下, `createPinia` 返回一个方法 或者 一个实现 `install` 的对象, 下面进入代码

代码文件: `packages/pinia/src/createPinia.ts`

```typescript
export function createPinia(): Pinia {
  /** */
  const pinia: Pinia = markRaw({
    // 实现的 install 用于 注册
    install(app: App) {
      /** */
    },

    // 注册 pinia 的plugin 比如持久化的
    use(plugin) {
      /** */
    },

    _p, // 保存 plugin
    _a: null, // 保存 挂载的的 app
    _e: scope, // 保存 defineStore 里面的 computed 对应的 scope
    _s: new Map<string, StoreGeneric>(), // 保存的经过处理的 store
    state, // 保存的原本的 state
  });

  /** */
  return pinia;
}
```

---

#### defineStore

<style scoped>
section {
  font-size: 26px;
}
</style>

`const useXxx = defineStore(/** */)`, 由此可见 `defineStore` 返回的是一个方法

代码文件: `packages/pinia/src/store.ts`

```typescript
export function defineStore(
  idOrOptions: any,
  setup?: any,
  setupOptions?: any,
): StoreDefinition {
  let id: string;
  let options: /** */;

  const isSetupStore = typeof setup === 'function';
  if (typeof idOrOptions === 'string') {
    id = idOrOptions;
    options = isSetupStore ? setupOptions : setup;
  } else {
    options = idOrOptions;
    id = idOrOptions.id;
    /** */
  }
```

---

<style scoped>
  section {
    padding-top: 60px;
  }
</style>

```typescript
  function useStore(pinia?: Pinia | null, hot?: StoreGeneric): StoreGeneric {
    const hasContext = hasInjectionContext();
    pinia =
      (__TEST__ && activePinia && activePinia._testing ? null : pinia) ||
      (hasContext ? inject(piniaSymbol, null) : null);
    if (pinia) setActivePinia(pinia);
    /** */
    pinia = activePinia!;

    if (!pinia._s.has(id)) {
      if (isSetupStore) {
        createSetupStore(id, setup, options, pinia);
      } else {
        createOptionsStore(id, options as any, pinia);
      }
      /** */
    }

    const store: StoreGeneric = pinia._s.get(id)!;
    /** */
    return store as any;
  }

  useStore.$id = id;

  return useStore;
}
```

我们可以注意到两个方法 `createSetupStore`, `createOptionsStore`

---

<style scoped>
  section {
    padding-top: 40px;
  }
</style>

#### createOptionsStore

```typescript
function createOptionsStore<
  Id extends string,
  S extends StateTree,
  G extends _GettersTree<S>,
  A extends _ActionsTree,
>(
  id: Id,
  options: DefineStoreOptions<Id, S, G, A>,
  pinia: Pinia,
  hot?: boolean,
): Store<Id, S, G, A> {
  const { state, actions, getters } = options;

  const initialState: StateTree | undefined = pinia.state.value[id];

  let store: Store<Id, S, G, A>;

  function setup() {
    /** */
  }

  store = createSetupStore(id, setup, options, pinia, hot, true);

  return store as any;
}
```

---

<style scoped>
  section {
    padding-top: 40px;
  }
</style>

`setup` 实现

```typescript
function setup() {
  if (!initialState && (!__DEV__ || !hot)) {
    if (isVue2) {
      set(pinia.state.value, id, state ? state() : {});
    } else {
      pinia.state.value[id] = state ? state() : {};
    }
  }

  const localState =
    __DEV__ && hot
      ? toRefs(ref(state ? state() : {}).value)
      : toRefs(pinia.state.value[id]);

  return assign(
    localState,
    actions,
    Object.keys(getters || {}).reduce((computedGetters, name) => {
      /** */
      computedGetters[name] = markRaw(
        computed(() => {
          setActivePinia(pinia);
          const store = pinia._s.get(id)!;
          if (isVue2 && !store._r) return;
          return getters![name].call(store, store);
        }),
      );
      return computedGetters;
    }, {} as Record<string, ComputedRef>),
  );
}
```

---

我们总结下 `createOptionsStore`

1. 首先处理的情况是 对象包含 `getters`, `state`, `actions` 这样的情况
2. 通过内部的 `setup` 函数 重新处理 `state`, 主要处理的是
   - `state`: 通过 `toRefs` 包一层 `id` 对应的 `state`
   - `getters`: 用 `computed` 包一层
3. 处理好的参数传给 `createSetupStore`
4. 返回 `store`

---

<style scoped>
section {
  font-size: 30px;
}
</style>

#### createSetupStore

```typescript
function createSetupStore<
  Id extends string,
  SS extends Record<any, unknown>,
  S extends StateTree,
  G extends Record<string, _Method>,
  A extends _ActionsTree,
>(
  $id: Id,
  setup: () => SS,
  options:
    | DefineSetupStoreOptions<Id, S, G, A>
    | DefineStoreOptions<Id, S, G, A> = {},
  pinia: Pinia,
  hot?: boolean,
  isOptionsStore?: boolean,
): Store<Id, S, G, A> {
  let scope!: EffectScope;
  /** */
  const $subscribeOptions: WatchOptions = {
    deep: true,
    // flush: 'post',
  };
  /** */
  let subscriptions: SubscriptionCallback<S>[] = [];
  let actionSubscriptions: StoreOnActionListener<Id, S, G, A>[] = [];
  let debuggerEvents: DebuggerEvent[] | DebuggerEvent;
  const initialState = pinia.state.value[$id] as UnwrapRef<S> | undefined;
  if (!isOptionsStore && !initialState && (!__DEV__ || !hot)) {
    /* istanbul ignore if */
    if (isVue2) {
      set(pinia.state.value, $id, {});
    } else {
      pinia.state.value[$id] = {};
    }
  }
  /** */
```

---

<style scoped>
section {
  font-size: 20px;
  padding-top: 70px;
}
</style>

```typescript
let activeListener: Symbol | undefined;
function $patch(stateMutation: (state: UnwrapRef<S>) => void): void;
function $patch(partialState: _DeepPartial<UnwrapRef<S>>): void;
function $patch(
  partialStateOrMutator:
    | _DeepPartial<UnwrapRef<S>>
    | ((state: UnwrapRef<S>) => void),
): void {
  /** */
}
const $reset; /** */
function $dispose() {
  /** */
}
function wrapAction(name: string, action: _Method) {
  /** */
}
/** */
const partialStore = {
  _p: pinia,
  // _s: scope,
  $id,
  $onAction: addSubscription.bind(null, actionSubscriptions),
  $patch,
  $reset,
  $subscribe(callback, options = {}) {
    /** */
  },
  $dispose,
} as _StoreWithState<Id, S, G, A>;

if (isVue2) {
  partialStore._r = false;
}
```

---

<style scoped>
section {
  font-size: 20px;
  padding-top: 70px;
}
</style>

```typescript
const store: Store<Id, S, G, A> = reactive(
  __DEV__ || USE_DEVTOOLS
    ? assign(
        {
          _hmrPayload,
          _customProperties: markRaw(new Set<string>()),
        },
        partialStore,
      )
    : partialStore,
) as unknown as Store<Id, S, G, A>;

pinia._s.set($id, store);

const runWithContext =
  (pinia._a && pinia._a.runWithContext) || fallbackRunWithContext;

const setupStore = runWithContext(() =>
  pinia._e.run(() => (scope = effectScope()).run(setup)!),
)!;
```

---

<style scoped>
section {
  font-size: 20px;
  padding-top: 70px;
}
</style>

```typescript

  for (const key in setupStore) {
    const prop = setupStore[key];
    if ((isRef(prop) && !isComputed(prop)) || isReactive(prop)) {
      /** */
      if (!isOptionsStore) {
        /** */
        pinia.state.value[$id][key] = prop;
      }
      /** */
      // action
    } else if (typeof prop === 'function') {
      const actionValue = __DEV__ && hot ? prop : wrapAction(key, prop);
      setupStore[key] = actionValue;
      /** */
    }
  }
  /**  */
  assign(store, setupStore);
  assign(toRaw(store), setupStore);
  Object.defineProperty(store, '$state', {
    get: () => (__DEV__ && hot ? hotState.value : pinia.state.value[$id]),
    set: (state) => {
      /** */
      $patch(($state) => {
        assign($state, state);
      });
    },
  });
  /** */
  pinia._p.forEach((extender) => {
    /** */
  });
  /** */
  return store;
}
```

---

总结下 `createSetupStore` 做的事

1. 初始化 `subscriptions`, `actionSubscriptions` 用于后面 `收集` 订阅
2. 初始化 `partialStore` 这个对象 没有 `getters`, `action`, `state` 这些属性, 只有 `store`自带的方法, 比如 `$reset`
3. 保存 `pinia._s` 这个 `map` 里面
4. 获取 `setup` 方法返回值, 并和 `state` 整合
5. 处理 pinia `plugin`
6. 返回 store

---

<style scoped>
  section h4, p {
    font-size: 25px;
  }
</style>

#### pinia 中的 subscription

```typescript
// 添加订阅的fn
export function addSubscription<T extends _Method>(
  subscriptions: T[],
  callback: T,
  detached?: boolean,
  onCleanup: () => void = noop,
) {
  subscriptions.push(callback); // 保存进订阅数组
  // 移除 注册的 cb 的fn
  const removeSubscription = () => {
    const idx = subscriptions.indexOf(callback);
    if (idx > -1) {
      subscriptions.splice(idx, 1);
      onCleanup();
    }
  };
  // 没有被隔离, 还会将 移除函数 注册到 scope.cleanups里面
  if (!detached && getCurrentScope()) {
    onScopeDispose(removeSubscription);
  }
  // 返回移除的 fn
  return removeSubscription;
}
// 触发的订阅的fn
export function triggerSubscriptions<T extends _Method>(
  subscriptions: T[],
  ...args: Parameters<T>
) {
  subscriptions.slice().forEach((callback) => {
    callback(...args);
  });
}
```

简单的 `订阅收集`, `发布订阅` 就实现了, 下面我们就进入 `store` 上的 `收集` 与 `触发`

---

#### $patch 触发

```typescript
function $patch(stateMutation: (state: UnwrapRef<S>) => void): void;
function $patch(partialState: _DeepPartial<UnwrapRef<S>>): void;
function $patch(
  partialStateOrMutator:
    | _DeepPartial<UnwrapRef<S>>
    | ((state: UnwrapRef<S>) => void),
): void {
  let subscriptionMutation: SubscriptionCallbackMutation<S>;
  isListening = isSyncListening = false;
  if (__DEV__) {
    debuggerEvents = [];
  }
  if (typeof partialStateOrMutator === 'function') {
    partialStateOrMutator(pinia.state.value[$id] as UnwrapRef<S>);
    subscriptionMutation = {
      /** */
    };
  } else {
    mergeReactiveObjects(pinia.state.value[$id], partialStateOrMutator);
    subscriptionMutation = {
      /** */
    };
  }
  const myListenerId = (activeListener = Symbol());
  nextTick().then(() => {
    if (activeListener === myListenerId) {
      isListening = true;
    }
  });
  isSyncListening = true;
  triggerSubscriptions(
    subscriptions,
    subscriptionMutation,
    pinia.state.value[$id] as UnwrapRef<S>,
  );
}
```

---

主要做的事也很简单明了

1. 根据 `partialStateOrMutator` 不同的类型, 做对应的处理, 生成对应的 `subscriptionMutation`
   - `function` 调用 `partialStateOrMutator`
   - `object` 调用 `mergeReactiveObjects`
2. 执行 `triggerSubscriptions`

我们主要看 `mergeReactiveObjects`, 其实就看这个方法名, 我们也能猜到, 就是整合两个对象,

接受两个参数, 第一个参数是 `目标对象`, 第二个参数是 `被合并对象`

---

<style scoped>
section {
  padding: 70px;
}
</style>

```typescript
function mergeReactiveObjects<
  T extends Record<any, unknown> | Map<unknown, unknown> | Set<unknown>,
>(target: T, patchToApply: _DeepPartial<T>): T {
  // 处理都是 map
  if (target instanceof Map && patchToApply instanceof Map) {
    patchToApply.forEach((value, key) => target.set(key, value));
  }
  // 处理都是 set
  if (target instanceof Set && patchToApply instanceof Set) {
    patchToApply.forEach(target.add, target);
  }
  for (const key in patchToApply) {
    if (!patchToApply.hasOwnProperty(key)) continue;
    const subPatch = patchToApply[key];
    const targetValue = target[key];
    if (
      isPlainObject(targetValue) &&
      isPlainObject(subPatch) &&
      target.hasOwnProperty(key) &&
      !isRef(subPatch) &&
      !isReactive(subPatch)
    ) {
      target[key] = mergeReactiveObjects(targetValue, subPatch);
    } else {
      target[key] = subPatch;
    }
  }
  return target;
}
```

---

<style scoped>
section {
  font-size: 22px;
}
</style>

#### $subscribe 收集

```typescript
function $subscribe(callback, options = {}) {
  const removeSubscription = addSubscription(
    subscriptions,
    callback,
    options.detached,
    () => stopWatcher(),
  );
  const stopWatcher = scope.run(() =>
    watch(
      () => pinia.state.value[$id] as UnwrapRef<S>,
      (state) => {
        /** */
      },
      assign({}, $subscribeOptions, options),
    ),
  )!;
  return removeSubscription;
}
```

主要的逻辑就三:

1. 使用 `watch` 返回一个 `stopWatcher` 的方法 作为 `addSubscription` 的 第四个参数
2. 调用 `addSubscription` 收集 `callback`
3. 返回 移除 `callback` 的 方法

思考一下? 为啥会在 `$subscribe` 里面使用 `watch` ?

---

其实很简单, 在 `Pinia` 中我们除了 使用 `$patch` 外, 还可以直接修改 `state`, 这也正好对应了 `MutationType` 这个 枚举类型

```typescript
export enum MutationType {
  // 直接修改 store.xxx = aaa
  direct = 'direct',

  // $patch({xxx: aaa})
  patchObject = 'patch object',

  // $patch((state) => state.xxx = aaa)
  patchFunction = 'patch function',
}
```

---

#### $reset

```typescript
const $reset = isOptionsStore
  ? function $reset(this: _StoreWithState<Id, S, G, A>) {
      const { state } = options as DefineStoreOptions<Id, S, G, A>;
      const newState = state ? state() : {};
      this.$patch(($state) => {
        assign($state, newState);
      });
    }
  : __DEV__
  ? () => {
      throw new Error(
        `🍍: Store "${$id}" is built using the setup syntax and does not implement $reset().`,
      );
    }
  : noop;
```

首先我们能看出来 `$reset` 只针对 `optionsStore`, 内部还是使用了 `$patch`

---

#### $dispose

> `dispose` 意为 `处理/丢掉`

```typescript
function $dispose() {
  scope.stop();
  subscriptions = [];
  actionSubscriptions = [];
  pinia._s.delete($id);
}
```

1. 停止 `scope` 下 收集的所有的 `computed/watch`
2. 重置 `subscriptions`, `actionSubscriptions`
3. 从 `pinia._s` 这个 `map` 移除

---

<style scoped>
  section {
    font-size: 19px;
  }
</style>

#### mapHelpers

可以理解为这类方法是专门服务于 vue 的 `option` 写法的

思路其实很简单, 就是 `映射`, 比如我访问 `mapXxxResult.xxx` 其实就是访问的 `useStore().xxx`

下面我拿 `mapState/mapGetters` 举例, 别的`mapXxx` 实现都是一个思路

```typescript
export function mapState<
  Id extends string,
  S extends StateTree,
  G extends _GettersTree<S>,
  A,
>(
  useStore: StoreDefinition<Id, S, G, A>,
  keysOrMapper: any,
): _MapStateReturn<S, G> | _MapStateObjectReturn<Id, S, G, A> {
  return Array.isArray(keysOrMapper)
    ? keysOrMapper.reduce((reduced, key) => {
        reduced[key] = function (this: ComponentPublicInstance) {
          return useStore(this.$pinia)[key];
        } as () => any;
        return reduced;
      }, {} as _MapStateReturn<S, G>)
    : Object.keys(keysOrMapper).reduce((reduced, key: string) => {
        reduced[key] = function (this: ComponentPublicInstance) {
          const store = useStore(this.$pinia);
          const storeKey = keysOrMapper[key];
          return typeof storeKey === 'function'
            ? (storeKey as (store: Store<Id, S, G, A>) => any).call(this, store)
            : store[storeKey];
        };
        return reduced;
      }, {} as _MapStateObjectReturn<Id, S, G, A>);
}
```

---

`mapState` 接受 两个参数

1. 定义 `store` 的 返回函数, 即 `useXxxStore`
2. 需要重新命名的 `keyArray` 或者 重命名的 `keyMap`

主要的返回就是 `映射` 完成之后的对象, 这里我简单的提一嘴, 就这种 思路, 还有很多实现的地方, 比如 `pinia` 自带的 `storeToRefs`, `vue` 中的 `proxyRefs`

---

# 谢谢观看
