const targetMap = new WeakMap();
export let activeEffect,
  shouldTrack = true; // 是否应该track 解决 数组改变自身的方法, 不然会导致爆栈

export function pauseTracking() {
  shouldTrack = false;
}

export function enableTracking() {
  shouldTrack = true;
}

export class ReactiveEffect {
  constructor(fn, scheduler) {
    this.fn = fn;
    this.scheduler = scheduler;
    this.parent = undefined;
  }

  run() {
    try {
      activeEffect = this;
      return this.fn();
    } finally {
      activeEffect = undefined;
    }
  }
}

export function effect(fn, options) {
  const _effect = new ReactiveEffect(fn);
  Object.assign(_effect, options);
  // 自己执行
  _effect.run();
  // 通过bind, 返回执行器
  const effectRun = _effect.run.bind(_effect);
  return effectRun;
}

export function track(target, key) {
  if (activeEffect && shouldTrack) {
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()));
    }
    let deps = depsMap.get(key);
    if (!deps) {
      depsMap.set(key, (deps = new Set()));
    }
    trackEffects(deps);
  }
}

export function trackEffects(deps) {
  deps.add(activeEffect);
}

export function trigger(target, type, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    return;
  }
  const deps = [];
  if (key !== undefined) {
    deps.push(depsMap.get(key));
  }
  switch (type) {
    case 'add':
      if (isArray(target)) {
        // 数组的添加 会改变 长度
        deps.push(depsMap.get('length'));
      } else {
        // 对象的key 值增加 会影响 遍历
        deps.push(depsMap.get('iterator_key'));
      }
      break;
    case 'delete':
      if (!isArray(target)) {
        deps.push(depsMap.get(ITERATE_KEY));
      }
      break;
    case 'set':
      // todo
      break;
  }
  const flatDep = [];
  for (const dep of deps) {
    if (dep) {
      flatDep.push(...dep);
    }
  }
  triggerEffects(flatDep);
}

export function triggerEffects(dep) {
  const effects = [...dep];
  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i];
    if (effect !== activeEffect) {
      // 解决循环依赖
      if (effect.scheduler) {
        effect.scheduler();
      } else {
        effect.run();
      }
    }
  }
}
