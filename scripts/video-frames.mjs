/**
 * Frame helpers shared by the video scripts. Playwright's Chromium has no H.264 decoder, so a
 * video is cut into PNG frames with ffmpeg before a page reads it, and rendered frames are joined
 * back into a video the same way.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Cut a video into numbered PNG frames in a fresh temporary directory.
 * @param video Path to the video
 * @param framesPerSecond The rate to sample it at
 * @returns The directory and its frame file names, in order
 */
export const cutFrames = (video, framesPerSecond) => {
  const directory = mkdtempSync(join(tmpdir(), 'video-frames-'))
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-i',
    video,
    '-vf',
    `fps=${framesPerSecond}`,
    join(directory, '%05d.png')
  ])
  return {
    directory,
    files: readdirSync(directory)
      .filter((name) => name.endsWith('.png'))
      .sort()
  }
}

/**
 * Join numbered PNG frames into an H.264 video any player opens.
 * @param directory Where the frames are, named `%05d.png`
 * @param framesPerSecond The rate to play them at
 * @param output Path of the video to write
 */
export const joinFrames = (directory, framesPerSecond, output) =>
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-framerate',
    String(framesPerSecond),
    '-i',
    join(directory, '%05d.png'),
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    output
  ])
