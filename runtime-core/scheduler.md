---
marp: true
---

# scheduler

`vue3.x` 中的 调度的实现 其实是通过 `scheduler` 这个文件实现的. 在此之前,我们试想一下如果没有调度会发生什么?

```typescript
const count = ref(1);
watchEffect(() => {
  console.log(count.value);
});
count.value++;
count.value++;
count.value++;
```

如果没有调度 应该会打印出 `2, 3, 4`, 但是实际上我们不需要关注中的状态, 即 `2, 3`, 我们关注的只是最后的结果 即 `4`, 同理 一个组件的频繁 `update` 我们不需要把 中间的的结果展示(也还是未更新完), 我们只需要展示最后一次就行, 所以我们需要 `调度`

我们需要需要哪些东西? 保存任务的 `queue`, 标记当前正在执行 `queue` 中任务的标记, 等等

```javascript

```

---
