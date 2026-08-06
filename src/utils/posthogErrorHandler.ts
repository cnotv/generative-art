import type { App } from 'vue'
import posthog from 'posthog-js'

export const registerPosthogErrorHandler = (app: App, posthogEnabled: boolean): void => {
  const previousErrorHandler = app.config.errorHandler
  app.config.errorHandler = (error, instance, info) => {
    if (posthogEnabled) {
      posthog.captureException(error)
    }
    previousErrorHandler?.(error, instance, info)
  }
}
