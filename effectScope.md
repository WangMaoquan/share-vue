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

# EffectScope

---

<style scoped>
  section {
    font-size: 30px;
  }
</style>

## What is EffectScope

`effect` 意为 `作用, 影响`, `scope` 意为 `范围, 领域`, 大抵可以理解为 `管理/收集 范围内所有的影响 的 Api`

可能还是不太清晰? 比如为什么要 `管理/收集` 这些 `影响`, 什么叫 `范围内`, 下面我会按照我的理解来一一扯淡

- `管理/收集`: 其实 `管理` 就包括了 `收集`, 毕竟 `收集` 就是为了去更好的 `管理`, 管理 其实就是可以做一些`统一的操作`, 毕竟 `收集` 的极大可能都是 `相同类型的数据`, 这样才能 `统一处理`
- `影响`: 其实更直观的就是 `side effect` 即 `副作用`
- `范围`: 一个代码块是一个 `范围`, 一个函数是一个 `范围`, 一个组件其实也是一个 `范围`

所以我们就拿 `vue` 来说, `effectScope` 简单来说就是管理一个组件内所有副作用的 Api

---

### 纯函数 与 副作用函数

`纯函数` 的概念就是 `即相同的输入，永远会得到相同的输出，而且没有任何可观察的副作用`

上面的话, 我们可以分成两部分来理解:

1. 相同的输入，永远会得到相同的输出
2. 没有任何可观察的副作用

`相同的输入，永远会得到相同的输出` 这句话要怎么理解呢? 我们先知道两个概念 `mutable` 与 `immutable`

- `mutable`: 意为 `可变的`, 在 `JavaScript` 中, 我们可以理解为 `引用类型` 的值
- `immutable`: 意为 `不可变的`, 在 `JavaScript`中, 我们可以理解为 `基本类型` 的值

两者最主要的区别就是当对一个变量进行改变的时候, `immutable` 只能为这个变量再创建一个新地址来保存, 在新的地址中改变, 而 `mutable` 则可以在原本的地址改变, 下面是几个例子:

```javascript
// 我们没办法直接修改 str 对应的值
let str = 'decade';
// str[0] = 1;
console.log(str); // 'decade'
console.log(str.toUpperCase()); // "DECADE"
console.log(str); //"decade"
// 我们能做的只有把返回的新字符串重新赋值给变量
str = str.toUpperCase(); // "DECADE"
```

---

## Why does EffectScope appear

---

## How to use EffectScope

---

## How to implement EffectScope
