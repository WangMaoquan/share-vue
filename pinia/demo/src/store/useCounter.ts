import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

// 一个参数, 是对象

// const useCounter = defineStore<
//   'counter',
//   { count: number },
//   {
//     getDoubleCount: () => number;
//   },
//   {
//     addCount: (num: number) => void;
//   }
// >({
//   id: 'counter',
//   state: () => {
//     return {
//       count: 0,
//     };
//   },
//   getters: {
//     getDoubleCount() {
//       return this.count * 2;
//     },
//   },
//   actions: {
//     addCount(num) {
//       this.count += num;
//     },
//   },
// });

// 两个参数, 第二个是对象

const useCounter = defineStore<
  'counter',
  { count: number },
  {
    getDoubleCount: () => number;
  },
  {
    addCount: (num: number) => void;
  }
>('counter', {
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

// 两个参数 第二个参数是 方法

// const useCounter = defineStore('counter', () => {
//   const count = ref(0);

//   const count1 = ref(1);

//   const count2 = ref(2);

//   const getDoubleCount = computed(() => count.value * 2);

//   const addCount = (num: number) => (count.value += num);

//   return {
//     count,
//     count1,
//     count2,
//     getDoubleCount,
//     addCount,
//   };
// });

export default useCounter;
