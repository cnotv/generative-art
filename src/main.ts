import './style.css'
import './assets/styles/_variables.scss'
import './assets/styles/utilities.scss'
import './assets/styles/vendor.scss'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import * as Sentry from '@sentry/vue'
import { useUmami } from '@/utils/umami'

const { loadUmami } = useUmami()

const app = createApp(App)

Sentry.init({
  app,
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  // IP addresses and cookies are personal data under the GDPR; errors are useful without them
  sendDefaultPii: false
})

// Umami counts the portfolio only (plan limits). The same image also answers lab.cnotv.xyz
// until the portfolio moves to its own repository, so every other host sends nothing.
loadUmami({
  websiteId: import.meta.env.VITE_UMAMI_WEBSITE_ID,
  domains: 'cnotv.xyz'
})

app.use(createPinia())
app.use(router)

app.mount('#app')
