// @vitest-environment node
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { parseArguments } from './gh-video.mjs'

describe('parseArguments', () => {
  it.each([
    {
      scenario: 'collects file paths as absolute',
      argv: ['clip.mp4', 'other.mp4'],
      expected: {
        files: [resolve('clip.mp4'), resolve('other.mp4')],
        append: false,
        comment: false,
        pullRequest: ''
      }
    },
    {
      scenario: 'reads the pull request number without treating it as a file',
      argv: ['clip.mp4', '--pr', '270'],
      expected: { files: [resolve('clip.mp4')], append: false, comment: false, pullRequest: '270' }
    },
    {
      scenario: 'reads the posting flags',
      argv: ['--comment', '--append', 'clip.mp4'],
      expected: { files: [resolve('clip.mp4')], append: true, comment: true, pullRequest: '' }
    }
  ])('$scenario', ({ argv, expected }) => {
    expect(parseArguments(argv)).toEqual(expected)
  })
})
