import './style.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import * as Sentry from "@sentry/vue";

const app = createApp(App)


Sentry.init({
  app,
  dsn: import.meta.env.VITE_SENTRY_DSN,
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true
});

app.use(createPinia())
app.use(router)

app.mount('#app')
