import { afterEach, describe, it, expect } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { page } from 'vitest/browser'
import '@/style.css'
import '@/assets/styles/_variables.scss'
import GenerativeCanvas from './GenerativeCanvas.vue'

const SWAP_COUNT = 10

const readHostCount = (): string =>
  document.querySelector('[data-testid="host-count"] strong')?.textContent ?? ''

const readFrameStatus = (): string =>
  document.querySelector('[data-testid="frame-status"]')?.textContent ?? ''

const frame = () => page.frameLocator(page.getByTitle('Generated component'))

// The frame has an opaque origin, so expect.element cannot read inside it. A provider action
// such as hover can, and it fails when the element never appears.
const expectFrameText = (text: string): Promise<void> => frame().getByText(text).hover()

const waitForMounted = () => expect.poll(readFrameStatus).toBe('Frame: mounted')

const selectExample = async (label: string): Promise<void> => {
  await page.getByRole('button', { name: label, exact: true }).click()
}

describe('GenerativeCanvas', () => {
  enableAutoUnmount(afterEach)

  it('keeps the host count across repeated swaps', async () => {
    // Arrange
    mount(GenerativeCanvas, { attachTo: document.body })
    await waitForMounted()
    await frame().getByRole('button').click()
    await expect.poll(readHostCount).toBe('1')

    // Act
    await Array.from({ length: SWAP_COUNT }).reduce<Promise<void>>(
      (previousSwap, _unused, swapIndex) =>
        previousSwap.then(async () => {
          await selectExample(swapIndex % 2 === 0 ? 'Stepper card' : 'Pill button')
          await waitForMounted()
        }),
      Promise.resolve()
    )
    await frame().getByRole('button').click()

    // Assert
    await expect.poll(readHostCount).toBe('2')
    await expectFrameText('Clicked 2 times')
  })

  it.each([
    ['Compile error', 'Element is missing end tag'],
    ['Runtime error', 'This component fails while it mounts']
  ])('keeps the last good component after a %s', async (exampleLabel, expectedError) => {
    // Arrange
    mount(GenerativeCanvas, { attachTo: document.body })
    await waitForMounted()

    // Act
    await selectExample(exampleLabel)

    // Assert
    await expect.element(page.getByRole('alert')).toHaveTextContent(expectedError)
    await expectFrameText('Clicked 0 times')
  })
})
