<script setup lang="ts">
  import { useCounter } from '../store';

  const counter = useCounter();

  const add = () => {
    const num = Math.floor(Math.random() * 100 - 50);
    counter.addCount(num);
  };

  // counter.$reset();
</script>

<template>
  <div>{{ counter.count }}</div>
  <button @click="add">add</button>
</template>
