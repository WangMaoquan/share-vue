<script lang="ts">
  import { mapState, mapActions } from 'pinia';
  import { useCounter } from '../store';

  export default {
    methods: {
      ...mapActions(useCounter, {
        myAddCount: 'addCount',
      }),
      add() {
        const num = Math.floor(Math.random() * 100 - 50);
        this.myAddCount(num);
      },
    },
    computed: {
      ...mapState(useCounter, {
        myCount: 'count',
      }),
    },
  };
</script>

<template>
  <div>{{ myCount }}</div>
  <button @click="add">add</button>
</template>
