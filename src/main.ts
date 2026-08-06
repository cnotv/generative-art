import './style.css'
import './assets/styles/_variables.scss'
import './assets/styles/utilities.scss'
import './assets/styles/vendor.scss'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import * as Sentry from '@sentry/vue'
import posthog from 'posthog-js'
import { useUmami } from '@/utils/umami'
import { registerPosthogErrorHandler } from '@/utils/posthogErrorHandler'

const { loadUmami } = useUmami()

const app = createApp(App)

const posthogProjectToken = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN
const posthogHost = import.meta.env.VITE_POSTHOG_HOST

const posthogEnabled = Boolean(posthogProjectToken && posthogHost)

if (posthogEnabled) {
  posthog.init(posthogProjectToken!, {
    api_host: posthogHost!,
    defaults: '2026-01-30',
    capture_exceptions: {
      capture_unhandled_errors: true,
      capture_unhandled_rejections: true,
      capture_console_errors: false
    }
  })
} else if (import.meta.env.DEV) {
  const missingVariable = posthogProjectToken ? 'VITE_POSTHOG_HOST' : 'VITE_POSTHOG_PROJECT_TOKEN'
  throw new Error(
    `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`
  )
}

Sentry.init({
  app,
  dsn: import.meta.env.VITE_SENTRY_DSN,
  sendDefaultPii: true
})

loadUmami({
  websiteId: import.meta.env.VITE_UMAMI_WEBSITE_ID!
})

app.use(createPinia())
app.use(router)

registerPosthogErrorHandler(app, posthogEnabled)

app.mount('#app')
