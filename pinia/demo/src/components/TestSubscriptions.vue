<template>
  <div>
    <span>count: {{ counter.count }}</span>
    <button @click="changeCount">changeCount</button>
  </div>
  <div>
    <span>count1: {{ counter.count1 }}</span>
    <button @click="changeCount1">changeCount1</button>
  </div>
  <div>
    <span>count2: {{ counter.count2 }}</span>
    <button @click="changeCount2">changeCount2</button>
  </div>
</template>

<script lang="ts">
  import { defineComponent, ref } from 'vue';
  import { useCounter } from '../store';
  export default defineComponent({
    setup() {
      const counter = useCounter();

      const count = ref(1);

      count.value;

      const stop = counter.$subscribe(({ type, events }, state) => {
        console.log(type, 'type');
        console.log(events, 'events');
        console.log(state, 'state');
      });

      const getCount = () => Math.floor(Math.random() * 100 - 50);

      const changeCount = () => {
        counter.count = getCount();
      };

      const changeCount1 = () => {
        counter.$patch({
          count1: getCount(),
        });
      };

      const changeCount2 = () => {
        counter.$patch((state) => (state.count = 1));
      };

      return {
        changeCount,
        changeCount1,
        changeCount2,
        counter,
        count,
      };
    },
  });
</script>
