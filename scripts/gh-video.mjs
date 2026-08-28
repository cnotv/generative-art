/**
 * Uploads a video to GitHub's attachment store and prints the asset URL, which is the only
 * form GitHub renders as an inline player. There is no REST or GraphQL endpoint for this:
 * the upload runs through a logged-in browser session held in a persistent Chromium profile.
 *
 * Usage:
 *   node scripts/gh-video.mjs <file...> [--pr <number>] [--append] [--comment]
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const profileDirectory = join(homedir(), '.cache', 'gh-media-upload')
const assetUrlPattern = /https:\/\/github\.com\/user-attachments\/assets\/[\da-f-]+/g

const runGitHubCommand = (args) => execFileSync('gh', args, { encoding: 'utf8' }).trim()

export const parseArguments = (argv) =>
  argv.reduce(
    (parsed, argument, index, all) => {
      if (argument === '--append') return { ...parsed, append: true }
      if (argument === '--comment') return { ...parsed, comment: true }
      if (argument === '--pr') return { ...parsed, pullRequest: all[index + 1] }
      if (all[index - 1] === '--pr') return parsed
      return { ...parsed, files: [...parsed.files, resolve(argument)] }
    },
    { files: [], append: false, comment: false, pullRequest: '' }
  )

const readSignedInUser = (page) =>
  page
    .evaluate(() => document.querySelector('meta[name="user-login"]')?.content ?? '')
    .catch(() => '')

const waitForSignIn = async () => {
  const context = await chromium.launchPersistentContext(profileDirectory, {
    headless: false,
    viewport: { width: 1400, height: 950 }
  })
  const page = context.pages()[0] ?? (await context.newPage())
  await page.goto('https://github.com/login', { waitUntil: 'domcontentloaded' })
  console.error('Sign in to GitHub in the browser window. It closes itself once you are in.')

  const pollUntilSignedIn = async (deadline) => {
    if (Date.now() > deadline) return ''
    await page.waitForTimeout(3000)
    const user = await readSignedInUser(page)
    return user || pollUntilSignedIn(deadline)
  }

  const user = await pollUntilSignedIn(Date.now() + 1800000)
  await context.close()
  if (!user) throw new Error('Sign in timed out')
  console.error(`Signed in as ${user}`)
}

const uploadOne = async (page, filePath) => {
  if (!existsSync(filePath)) throw new Error(`No such file: ${filePath}`)
  const before = await page.inputValue('#new_comment_field')
  await page.setInputFiles('#fc-new_comment_field', filePath)
  await page.waitForFunction(
    (previous) => {
      const field = document.querySelector('#new_comment_field')
      return Boolean(field) && field.value !== previous && field.value.includes('user-attachments')
    },
    before,
    { timeout: 600000 }
  )
  const after = await page.inputValue('#new_comment_field')
  const found = after.match(assetUrlPattern) ?? []
  return found[found.length - 1]
}

const clearDraft = (page) =>
  page.evaluate(() => {
    const field = document.querySelector('#new_comment_field')
    if (!field) return
    field.value = ''
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })

const uploadAll = async (pullRequestUrl, files) => {
  const context = await chromium.launchPersistentContext(profileDirectory, {
    headless: true,
    viewport: { width: 1400, height: 950 }
  })
  const page = context.pages()[0] ?? (await context.newPage())
  await page.goto(pullRequestUrl, { waitUntil: 'domcontentloaded' })

  if (!(await readSignedInUser(page))) {
    await context.close()
    return null
  }
  await page.waitForSelector('#fc-new_comment_field', { state: 'attached', timeout: 60000 })

  const urls = await files.reduce(
    async (collected, filePath) => [...(await collected), await uploadOne(page, filePath)],
    Promise.resolve([])
  )

  await clearDraft(page)
  await page.waitForTimeout(1000)
  await context.close()
  return urls
}

const main = async () => {
  const { files, append, comment, pullRequest } = parseArguments(process.argv.slice(2))
  if (files.length === 0) {
    console.error('Usage: node scripts/gh-video.mjs <file...> [--pr <number>] [--append|--comment]')
    process.exit(1)
  }

  const repository = runGitHubCommand([
    'repo',
    'view',
    '--json',
    'nameWithOwner',
    '-q',
    '.nameWithOwner'
  ])
  const number =
    pullRequest || runGitHubCommand(['pr', 'view', '--json', 'number', '-q', '.number'])
  const pullRequestUrl = `https://github.com/${repository}/pull/${number}`

  const uploaded =
    (await uploadAll(pullRequestUrl, files)) ??
    (await waitForSignIn().then(() => uploadAll(pullRequestUrl, files)))

  const markdown = uploaded.join('\n\n')
  console.log(markdown)

  if (append) {
    const body = runGitHubCommand(['pr', 'view', number, '--json', 'body', '-q', '.body'])
    runGitHubCommand(['pr', 'edit', number, '--body', `${body}\n\n${markdown}\n`])
    console.error(`Appended to ${pullRequestUrl}`)
  }

  if (comment) {
    runGitHubCommand(['pr', 'comment', number, '--body', markdown])
    console.error(`Commented on ${pullRequestUrl}`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
