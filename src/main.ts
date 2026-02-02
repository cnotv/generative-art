import './style.css'
import './styles/tailwind.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import * as Sentry from "@sentry/vue";
import { useUmami } from '@/utils/umami';

const { loadUmami } = useUmami();

const app = createApp(App)

Sentry.init({
  app,
  dsn: import.meta.env.VITE_SENTRY_DSN,
  sendDefaultPii: true
});

loadUmami({
  websiteId: import.meta.env.VITE_UMAMI_WEBSITE_ID!,
});

app.use(createPinia())
app.use(router)

app.mount('#app')
