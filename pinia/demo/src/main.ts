import { createApp } from 'vue';
import './style.css';
import App from './App.vue';
import { createPinia } from 'pinia';

import { useCounter } from './store';

createApp(App).use(createPinia()).mount('#app');

const couter = useCounter();
console.log(couter);
