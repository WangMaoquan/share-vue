<script setup lang="ts">
  import Options from './components/Options.vue';
  import Setup from './components/Setup.vue';
  import TestSubscriptions from './components/TestSubscriptions.vue';
</script>

<template>
  <div>
    <span> options </span>
    <Options />
  </div>
  <div>
    <span> setup </span>
    <Setup />
  </div>
  <div>
    <span>TestSubscriptions</span>
    <TestSubscriptions />
  </div>
</template>
