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

## 全局定义

```typescript
export type SchedulerJobs = SchedulerJob | SchedulerJob[];
let isFlushing = false; // 是否正在执行的标志
let isFlushPending = false; // 是否正在等待执行的标志
const queue: SchedulerJob[] = []; // 保存任务队列
let flushIndex = 0; // 执行 job 的 在 queue 中下标
const resolvedPromise = /*#__PURE__*/ Promise.resolve() as Promise<any>; // resolve Promise
let currentFlushPromise: Promise<void> | null = null; // 当前正在 等待的 Promise
const RECURSION_LIMIT = 100; // 递归限制
type CountMap = Map<SchedulerJob, number>; // 递归次数的map
```

## 添加进队列的方法 queueoJob

```typescript
export function queueJob(job: SchedulerJob) {
  // queue 为空 或者 该job 没有进 queue, 或者 该 job 允许递归
  if (
    !queue.length ||
    !queue.includes(
      job,
      isFlushing && job.allowRecurse ? flushIndex + 1 : flushIndex,
    )
  ) {
    // 不存在 id 直接push
    if (job.id == null) {
      queue.push(job);
    } else {
      // 存在 id 找到插入的位置
      queue.splice(findInsertionIndex(job.id), 0, job);
    }
    queueFlush();
  }
}
```

**findInsertionIndex**

```typescript
function findInsertionIndex(id: number) {
  let start = flushIndex + 1;
  let end = queue.length;
  while (start < end) {
    const middle = (start + end) >>> 1;
    const middleJobId = getId(queue[middle]);
    middleJobId < id ? (start = middle + 1) : (end = middle);
  }

  return start;
}
```

一眼 `二分查找`

---

## queueFlush

```typescript
function queueFlush() {
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true;
    currentFlushPromise = resolvedPromise.then(flushJobs);
  }
}
```

---

## flushJobs

```typescript
function flushJobs(seen?: CountMap) {
  isFlushPending = false;
  isFlushing = true;
  if (__DEV__) {
    seen = seen || new Map();
  }
  queue.sort(comparator);
  const check = __DEV__
    ? (job: SchedulerJob) => checkRecursiveUpdates(seen!, job)
    : NOOP;

  try {
    for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
      const job = queue[flushIndex];
      if (job && job.active !== false) {
        if (__DEV__ && check(job)) {
          continue;
        }
        callWithErrorHandling(job, null, ErrorCodes.SCHEDULER);
      }
    }
  } finally {
    flushIndex = 0;
    queue.length = 0;
    flushPostFlushCbs(seen);
    isFlushing = false;
    currentFlushPromise = null;
    if (queue.length || pendingPostFlushCbs.length) {
      flushJobs(seen);
    }
  }
}
```

主要做的

1. 恢复 `isFlushPending`, 修改 `isFlushing`
2. `queue` 排序, `id` 从小到大, `updateEffect` 应该是由 `父到子`, 
3. 循环执行 `queue` 中的 `job`
4. 恢复 `flushIndex`, 清空 `queue`, 恢复 `isFlushing`, 重置 `currentFlushPromise`

---

### comparator

```typescript
const getId = (job: SchedulerJob): number =>
  job.id == null ? Infinity : job.id;

const comparator = (a: SchedulerJob, b: SchedulerJob): number => {
  const diff = getId(a) - getId(b);
  if (diff === 0) {
    if (a.pre && !b.pre) return -1;
    if (b.pre && !a.pre) return 1;
  }
  return diff;
};
```

---
