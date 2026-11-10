---
sidebar_position: 29
---

# Analytics and error reporting

The deployed site counts page views with Umami and reports runtime errors to Sentry. Both
are configured by two values that Vite inlines into the bundle at build time, so they have to
reach the build, not the running container.

:::note Source files
`src/main.ts`, `src/utils/umami.ts`, `Dockerfile`, `.github/workflows/deploy.yml`
:::

## The two values

| Variable                | Where it comes from                               |
| ----------------------- | ------------------------------------------------- |
| `VITE_UMAMI_WEBSITE_ID` | Umami, Settings, Websites, the site's Website ID  |
| `VITE_SENTRY_DSN`       | Sentry, the project's Settings, Client Keys (DSN) |

Each site gets its own Umami website and its own Sentry project, so their numbers and errors
never mix. Store both as repository secrets under exactly these names; `deploy.yml` passes
them to the Docker build as build arguments.

## When a value is missing

- **No Umami id**: the tracking script is not loaded at all. That is the state of every local
  run and pull request preview, and the reason they send nothing.
- **No Sentry DSN**: Sentry initialises disabled and sends nothing.

So a fork, a preview or a local build needs no configuration and reports nothing.

## Privacy

Umami sets no cookies and stores no personal data, so it needs no consent banner, but the
privacy policy still names it. Sentry runs with `sendDefaultPii: false`, which keeps IP
addresses, cookies and request headers out of error reports; turning it on would make those
reports personal data under the GDPR. Each event carries the build mode as its environment.

## Checking a deploy

Open the deployed site with the network panel: a request to `cloud.umami.is/script.js`,
followed by one to `/api/send` answered with 200, means Umami is counting. A 400 there means
the id reached the build but is wrong. For Sentry, an error thrown from the console of the
deployed page appears in the project's Issues within a minute.
