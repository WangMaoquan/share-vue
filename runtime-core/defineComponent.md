---
marp: true
---

# defineComponent

返回的是一个组件, 其实主要的就是为了 `类型提示`

```typescript
export function defineComponent(
  options: unknown,
  extraOptions?: ComponentOptions,
) {
  return isFunction(options)
    ? /*#__PURE__*/ (() =>
        extend({ name: options.name }, extraOptions, { setup: options }))()
    : options;
}
```

实现很简单, 这个方法的目的就是为了 `类型提示`

- [ ] defineComponent 类型体操
