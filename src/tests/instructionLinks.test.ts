import { describe, it, expect } from 'vitest'
import { readdirSync, existsSync, readFileSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join, resolve, dirname } from 'node:path'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * Personal, per-machine files are gitignored on purpose, so they are absent from a clean
 * checkout while still being the correct thing for an instruction file to point at.
 * Naming one is documentation, not a broken link.
 * @param candidate Repo-relative path that was not found on disk.
 * @returns True when git deliberately ignores the path.
 */
const isIntentionallyIgnored = (candidate: string): boolean =>
  spawnSync('git', ['check-ignore', '--quiet', candidate], { cwd: REPO_ROOT }).status === 0

const FENCED_BLOCK = /```[\S\s]*?```/g
const BACKTICKED = /`([^\n`]+)`/g

/**
 * A referenced path is only checkable when it names a concrete file or directory.
 * Globs, placeholders and URLs describe a shape rather than a location.
 */
const isCheckablePath = (candidate: string): boolean => {
  if (!candidate.includes('/')) return false
  if (/[\s*<>{|}]/.test(candidate)) return false
  if (candidate.startsWith('http') || candidate.startsWith('@')) return false
  if (candidate.includes('…') || candidate.includes('...')) return false
  return /^(src|packages|documentation|scripts|public|\.github|\.claude|\.husky)\//.test(candidate)
}

const collectInstructionFiles = (): string[] => {
  const roots = [
    'AGENTS.md',
    'CLAUDE.md',
    '.github/copilot-instructions.md',
    'src/views/CLAUDE.md',
    'src/components/LobbyUI/CLAUDE.md',
    'packages/CLAUDE.md'
  ].filter((relative) => existsSync(join(REPO_ROOT, relative)))

  const instructionsDirectory = join(REPO_ROOT, '.github/instructions')
  const instructions = existsSync(instructionsDirectory)
    ? readdirSync(instructionsDirectory).map((name) => join('.github/instructions', name))
    : []

  const skillsDirectory = join(REPO_ROOT, '.claude/skills')
  const skills = existsSync(skillsDirectory)
    ? readdirSync(skillsDirectory)
        .filter((name) => statSync(join(skillsDirectory, name)).isDirectory())
        .map((name) => join('.claude/skills', name, 'SKILL.md'))
        .filter((relative) => existsSync(join(REPO_ROOT, relative)))
    : []

  return [...roots, ...instructions, ...skills]
}

const referencedPaths = (relativeFile: string): string[] => {
  const body = readFileSync(join(REPO_ROOT, relativeFile), 'utf8').replace(FENCED_BLOCK, '')
  return [...body.matchAll(BACKTICKED)]
    .map((match) => match[1].replace(/[),.:;]+$/, ''))
    .filter(isCheckablePath)
}

describe('agent instruction files', () => {
  const files = collectInstructionFiles()

  it('finds the instruction set', () => {
    expect(files.length).toBeGreaterThan(0)
    expect(files).toContain('AGENTS.md')
  })

  it.each(files)('%s references only paths that exist', (relativeFile) => {
    const missing = referencedPaths(relativeFile)
      .filter((candidate) => !existsSync(join(REPO_ROOT, candidate)))
      .filter((candidate) => !isIntentionallyIgnored(candidate))
    expect(missing).toEqual([])
  })

  it('keeps AGENTS.md short enough to stay read', () => {
    const lineCount = readFileSync(join(REPO_ROOT, 'AGENTS.md'), 'utf8').split('\n').length
    expect(lineCount).toBeLessThan(150)
  })

  it.each(files.filter((relative) => relative.startsWith('.claude/skills')))(
    '%s declares a name and a trigger-shaped description',
    (relativeFile) => {
      const body = readFileSync(join(REPO_ROOT, relativeFile), 'utf8')
      const frontmatter = body.split('---')[1] ?? ''

      expect(frontmatter).toMatch(/name:\s*\S+/)
      expect(frontmatter).toMatch(/description:/)
      // The description is the whole routing mechanism: it must say when to reach for the
      // skill, not what it does, or the skill never gets selected from a request.
      expect(frontmatter).toMatch(/\buse (when|after|before)\b/i)
    }
  )
})
