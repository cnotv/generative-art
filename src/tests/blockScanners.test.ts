// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { isScannerUserAgent } from '@/edge/blockScanners'

describe('isScannerUserAgent', () => {
  it.each([
    ['sqlmap', 'sqlmap/1.7.2#stable (https://sqlmap.org)'],
    ['nikto', 'Mozilla/5.00 (Nikto/2.5.0) (Evasions:None) (Test:Port Check)'],
    ['nuclei', 'Nuclei - Open-source project (github.com/projectdiscovery/nuclei)'],
    ['zgrab', 'Mozilla/5.0 zgrab/0.x'],
    ['masscan', 'masscan/1.3 (https://github.com/robertdavidgraham/masscan)'],
    ['gobuster', 'gobuster/3.6'],
    ['wpscan', 'WPScan v3.8.25 (https://wpscan.com/wordpress-security-scanner)']
  ])('blocks %s', (_name, userAgent) => {
    // Arrange, Act
    const blocked = isScannerUserAgent(userAgent)

    // Assert
    expect(blocked).toBe(true)
  })

  it.each([
    [
      'Chrome',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36'
    ],
    ['Googlebot', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
    ['Lighthouse', 'Mozilla/5.0 Chrome-Lighthouse'],
    ['a missing header', null]
  ])('lets %s through', (_name, userAgent) => {
    // Arrange, Act
    const blocked = isScannerUserAgent(userAgent)

    // Assert
    expect(blocked).toBe(false)
  })
})
