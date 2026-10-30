// Tools that announce themselves. A scanner that fakes a browser is not caught here.
const SCANNER_USER_AGENT_PATTERN =
  /sqlmap|nikto|nuclei|zgrab|masscan|nmap|gobuster|dirbuster|feroxbuster|ffuf|wpscan|acunetix|nessus|openvas|havij/i

/**
 * Tells whether a user agent header belongs to a known scanning tool.
 * @param userAgent - the request's user agent header, absent when the client sent none
 * @returns true when the request should be refused
 */
export const isScannerUserAgent = (userAgent: string | null): boolean =>
  userAgent !== null && SCANNER_USER_AGENT_PATTERN.test(userAgent)

/**
 * Refuses scanning tools with a 403; every other request carries on to the site.
 * Netlify runs this on its edge, outside the Vite build (see netlify.toml).
 * @param request - the incoming request
 * @returns a 403 response for a scanner, nothing otherwise
 */
const blockScanners = (request: Request): Response | undefined =>
  isScannerUserAgent(request.headers.get('user-agent'))
    ? new Response('Forbidden', { status: 403 })
    : undefined

export default blockScanners

// Pages are what scanners probe; heavy static files skip the function to save invocations.
export const config = {
  path: '/*',
  excludedPath: ['/assets/*', '/og/*', '/*.glb', '/*.fbx', '/*.mp3', '/*.webp', '/*.jpg', '/*.png']
}
