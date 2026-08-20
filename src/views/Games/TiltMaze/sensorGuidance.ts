import type { SensorGuidance, SensorPlatform, SensorState } from './types'

/**
 * Which browser family the player is in, from the user agent.
 *
 * Every iOS browser is WebKit underneath, so Chrome and Firefox on an iPhone face Safari's
 * gates and Safari's remedies — telling those users to "try another browser" is wrong advice,
 * and the platform, not the app, is what the guidance has to key off.
 * @param userAgent The navigator user agent string
 * @returns The platform whose settings actually govern the sensor
 */
export const getSensorPlatform = (userAgent: string): SensorPlatform => {
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios'
  // iPadOS reports as a Mac, and is only distinguishable by having a touch screen.
  if (
    /Macintosh/.test(userAgent) &&
    typeof navigator !== 'undefined' &&
    navigator.maxTouchPoints > 1
  )
    return 'ios'
  if (/Android/.test(userAgent)) return 'android'
  return 'desktop'
}

/**
 * Rewrite a page URL onto HTTPS, so an insecure origin can be escaped without the player
 * having to retype anything.
 * @param currentUrl The page's current URL
 * @returns The same URL over HTTPS, or null when it is already secure
 */
export const getSecureUrl = (currentUrl: string): string | null => {
  if (!currentUrl.startsWith('http://')) return null
  return `https://${currentUrl.slice('http://'.length)}`
}

/**
 * iOS 12 had a global Motion & Orientation Access switch in Safari's settings. iOS 13 removed
 * it and replaced it with the per-site prompt, so there is no toggle to find on any current
 * iPhone — a refusal is remembered against the site instead, and clearing that site's stored
 * data is what makes the prompt appear again.
 */
const IOS_RESET_STEPS = [
  'Open Settings, then Apps → Safari → Advanced → Website Data.',
  'Search for this site and swipe to delete its data.',
  'Reopen this page and tap Start — the permission prompt should appear again.',
  'Tap Allow when it does.'
]

const NOTHING_BLOCKING: SensorGuidance = {
  reason: null,
  title: '',
  summary: '',
  steps: [],
  fix: null,
  fixLabel: null
}

/**
 * Work out what, if anything, is stopping the tilt sensor, and what can be done about it.
 *
 * Each gate fails silently in the browser, so the player gets no error of their own — this
 * turns the observable state into one named cause with the most direct remedy available. A
 * remedy the page can perform itself is always preferred to an instruction, but iOS exposes no
 * way for a web page to open Settings, so those steps have to be described in words.
 * @param state What the page can observe about the sensor
 * @returns The blocking reason with its guidance, or a `reason` of null when nothing blocks
 */
export const getSensorGuidance = (state: SensorState): SensorGuidance => {
  const { isSupported, isSecureContext, permission, isReceiving, platform } = state

  // A desktop has no sensor to fix and never needed one: the keyboard is the intended input
  // there, so explaining a missing sensor would be interrupting a working game.
  if (platform === 'desktop') return NOTHING_BLOCKING

  if (!isSupported) {
    return {
      reason: 'unsupported',
      title: 'No tilt sensor here',
      summary: 'This browser reports no orientation sensor, so the board cannot follow a lean.',
      steps: ['Use the arrow keys to tilt the board.'],
      fix: null,
      fixLabel: null
    }
  }

  if (!isSecureContext) {
    return {
      reason: 'insecure-context',
      title: 'This page is not secure',
      summary:
        'Browsers only report device motion over HTTPS, and they drop the events silently — which is why the board looks frozen rather than showing an error.',
      steps: [
        'Switch to the HTTPS address below.',
        'Accept the certificate warning if the dev server shows one.',
        'If HTTPS is not running, start it with pnpm dev:mobile.'
      ],
      fix: 'reload-secure',
      fixLabel: 'Switch to HTTPS'
    }
  }

  if (permission === 'denied') {
    return {
      reason: 'permission-denied',
      title: 'Motion access is blocked',
      summary:
        platform === 'ios'
          ? 'iOS remembers a refusal against this site. There is no global switch to flip — iOS 13 removed the old Motion & Orientation Access setting — so the stored decision has to be cleared.'
          : 'This site was refused access to the motion sensor.',
      steps:
        platform === 'ios'
          ? IOS_RESET_STEPS
          : [
              'Open the site settings for this page in your browser.',
              'Allow motion sensors, then reload.'
            ],
      fix: 'request-permission',
      fixLabel: 'Ask again'
    }
  }

  if (permission === 'prompt') {
    return {
      reason: 'awaiting-permission',
      title: 'Allow motion access',
      summary: 'Tilting needs your permission before the sensor reports anything.',
      steps: ['Tap Allow when your browser asks.'],
      fix: 'request-permission',
      fixLabel: 'Allow motion'
    }
  }

  if (!isReceiving) {
    return {
      reason: 'silent-sensor',
      title: 'The sensor is not reporting',
      summary:
        'Motion access was granted, but no reading has arrived — the one failure that produces no error at all.',
      steps:
        platform === 'ios'
          ? [
              'Tap Try again — the prompt is only honoured while the tap is fresh.',
              'If no prompt appears, this site may hold an earlier refusal: clear it under Settings → Apps → Safari → Advanced → Website Data.',
              'Confirm the address starts with https — iOS reports no motion on an insecure page.'
            ]
          : ['Check that your device has a motion sensor.', 'Reload the page and try once more.'],
      fix: 'request-permission',
      fixLabel: 'Try again'
    }
  }

  return NOTHING_BLOCKING
}
