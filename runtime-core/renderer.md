---
marp: true
---

# renderer

`renderer` 意为渲染器, 为啥会存在渲染器呢? 我自己的理解是因为平台的 `差异性`, 这里的 `差异性` 就我的理解来说也就是, `创建/删除/修改元素的这些操作的实现是不同的`, 而 `renderer` 就是为了处理不同平台实现的问题, 为了生成不同的 `renderer` 其实我们只需要将 实现 当做参数传入就好了, 然后我们只需要在 `renderer` 内部实现我们 框架需要的逻辑, 比如 `mount/update/unmount`

## baseCreateRenderer

```typescript

```
