import { onBeforeUnmount, ref } from 'vue'
import type { MidiDeviceStatus, MidiDevicesState, MidiSnippet } from './types'

const FALLBACK_DEVICE_NAME = 'IAC Driver Bus 1'

const portNames = (ports: MIDIInputMap | MIDIOutputMap): string[] =>
  Array.from(ports.values(), (port) => port.name ?? port.id)

/**
 * The WebMIDI devices the browser exposes. Access is only requested when the player asks,
 * because every browser shows a permission prompt for it, and the lists follow devices being
 * plugged in or out until the component unmounts.
 * @returns the connection status, the input and output names, and the connect action
 */
export const useMidiDevices = (): MidiDevicesState => {
  const midiDeviceStatus = ref<MidiDeviceStatus>('idle')
  const midiInputNames = ref<string[]>([])
  const midiOutputNames = ref<string[]>([])
  const midiAccess = ref<MIDIAccess | null>(null)

  const readPorts = (): void => {
    if (midiAccess.value === null) {
      return
    }
    midiInputNames.value = portNames(midiAccess.value.inputs)
    midiOutputNames.value = portNames(midiAccess.value.outputs)
  }

  const connectMidiDevices = async (): Promise<void> => {
    if (typeof navigator.requestMIDIAccess !== 'function') {
      midiDeviceStatus.value = 'unsupported'
      return
    }
    midiDeviceStatus.value = 'connecting'
    try {
      midiAccess.value = await navigator.requestMIDIAccess()
      midiAccess.value.addEventListener('statechange', readPorts)
      readPorts()
      midiDeviceStatus.value = 'ready'
    } catch {
      midiDeviceStatus.value = 'denied'
    }
  }

  onBeforeUnmount(() => {
    midiAccess.value?.removeEventListener('statechange', readPorts)
  })

  return { midiDeviceStatus, midiInputNames, midiOutputNames, connectMidiDevices }
}

/**
 * Ready-to-run patterns for a keyboard, a controller and an output, naming the first detected
 * device of each kind so they work as soon as they are loaded.
 * @param inputName - the input to listen to, or null when none is connected
 * @param outputName - the output to send to, or null when none is connected
 * @returns the snippets in the order the tab lists them
 */
export const createMidiSnippets = (
  inputName: string | null,
  outputName: string | null
): MidiSnippet[] => {
  const input = JSON.stringify(inputName ?? FALLBACK_DEVICE_NAME)
  const output = JSON.stringify(outputName ?? FALLBACK_DEVICE_NAME)
  return [
    {
      id: 'keyboard',
      title: 'Play a keyboard',
      description: 'Notes from the input play through a Strudel synth while the pattern runs.',
      code: `const keys = await midikeys(${input})\n$: keys().s("sawtooth").lpf(1200).room(.3)`
    },
    {
      id: 'controller',
      title: 'Turn knobs',
      description: 'Control change 74 and 71 drive the filter of a running pattern.',
      code: `const cc = await midin(${input})\n$: note("c2 [eb2 g2] bb1 [g2 f2]").s("sawtooth")\n  .lpf(cc(74).range(200, 4000)).lpq(cc(71).range(0, 20))`
    },
    {
      id: 'output',
      title: 'Drive a synth',
      description: 'The pattern sends its notes to the output instead of the browser.',
      code: `$: note("c3 e3 g3 b3").midi(${output})`
    }
  ]
}
