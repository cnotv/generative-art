import { describe, it, expect, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { ref } from 'vue'
import GameLobbyWizard from './GameLobbyWizard.vue'
import type { LobbyPlayer } from '@/types/lobbyWizard'

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} })
}))

vi.mock('@/composables/useGameLobby', () => ({
  useGameLobby: () => ({
    isSearching: ref(false),
    pendingRequests: ref([]),
    startSearching: vi.fn(),
    stopSearching: vi.fn(),
    acceptRequest: vi.fn(() => null),
    ignoreRequest: vi.fn(),
    displayName: vi.fn((id: string) => id)
  })
}))

const STUBS = {
  GameCard: { template: '<div class="game-card"><slot /></div>' },
  Check: { template: '<span class="check-icon" />' }
}

const SOLO_PLAYER: LobbyPlayer = { id: 'peer-1', name: 'Solo', color: '#ff0000' }

const buildWrapper = (overrides: Record<string, unknown> = {}): VueWrapper => {
  return mount(GameLobbyWizard, {
    props: {
      playerName: 'Solo',
      playerColor: '#ff0000',
      isHost: true,
      playerList: [SOLO_PLAYER],
      roomId: 'room-abc',
      matchmakerRoom: 'test-matchmaker',
      configFields: [],
      accentColor: '#4caf50',
      ...overrides
    },
    global: { stubs: STUBS }
  })
}

describe('GameLobbyWizard — host single player', () => {
  it('shows profile step with a Start button', () => {
    const wrapper = buildWrapper()
    expect(wrapper.find('.glw__step-title').text()).toBe('Your profile')
    expect(wrapper.find('.glw__start-btn').exists()).toBe(true)
  })

  it('shows no Next button', () => {
    const wrapper = buildWrapper()
    const nextButton = wrapper.findAll('button').find((b) => b.text().includes('Next'))
    expect(nextButton).toBeUndefined()
  })

  it('shows enabled Start button by default', () => {
    const wrapper = buildWrapper()
    const startButton = wrapper.find('.glw__start-btn')
    expect(startButton.exists()).toBe(true)
    expect((startButton.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('emits startGame when Start is clicked', async () => {
    const wrapper = buildWrapper()
    await wrapper.find('.glw__start-btn').trigger('click')
    expect(wrapper.emitted('startGame')).toHaveLength(1)
  })
})

describe('GameLobbyWizard — canStart prop', () => {
  it('disables Start button when canStart is false', () => {
    const wrapper = buildWrapper({ canStart: false })
    const startButton = wrapper.find('.glw__start-btn')
    expect(startButton.attributes('disabled')).toBeDefined()
  })

  it('enables Start button when canStart is true', () => {
    const wrapper = buildWrapper({ canStart: true })
    const startButton = wrapper.find('.glw__start-btn')
    expect((startButton.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('enables Start button when canStart is undefined (not passed)', () => {
    const wrapper = buildWrapper()
    const startButton = wrapper.find('.glw__start-btn')
    expect((startButton.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('does not emit startGame when Start is disabled', async () => {
    const wrapper = buildWrapper({ canStart: false })
    await wrapper.find('.glw__start-btn').trigger('click')
    expect(wrapper.emitted('startGame')).toBeFalsy()
  })
})

describe('GameLobbyWizard — guest player (isHost=false)', () => {
  it('shows no Next button for a guest', () => {
    const wrapper = buildWrapper({ isHost: false })
    const nextButton = wrapper.findAll('button').find((b) => b.text().includes('Next'))
    expect(nextButton).toBeUndefined()
  })

  it('shows no Start button for a guest', () => {
    const wrapper = buildWrapper({ isHost: false })
    expect(wrapper.find('.glw__start-btn').exists()).toBe(false)
  })
})

describe('GameLobbyWizard — profile step', () => {
  it('renders the player name input', () => {
    const wrapper = buildWrapper()
    const input = wrapper.find('input[type="text"]')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('Solo')
  })

  it('emits update:playerName when input changes', async () => {
    const wrapper = buildWrapper()
    const input = wrapper.find('input[type="text"]')
    await input.setValue('NewName')
    expect(wrapper.emitted('update:playerName')).toBeTruthy()
  })

  it('renders color swatch buttons', () => {
    const wrapper = buildWrapper()
    const swatches = wrapper.findAll('.glw__swatch-btn')
    expect(swatches.length).toBeGreaterThan(0)
  })

  it('emits update:playerColor when a swatch is clicked', async () => {
    const wrapper = buildWrapper()
    const swatches = wrapper.findAll('.glw__swatch-btn')
    await swatches[0].trigger('click')
    expect(wrapper.emitted('update:playerColor')).toBeTruthy()
  })
})

describe('GameLobbyWizard — player count display', () => {
  it('shows player count when multiple players are present', () => {
    const wrapper = buildWrapper({
      playerList: [SOLO_PLAYER, { id: 'peer-2', name: 'Other', color: '#0000ff' }]
    })
    expect(wrapper.find('.glw__player-count').text()).toContain('2')
  })
})

describe('GameLobbyWizard — results / play-again mode', () => {
  it('shows Play Again button when showResults is true', () => {
    const wrapper = buildWrapper({ showResults: true })
    const playAgainButton = wrapper.find('.glw__start-btn')
    expect(playAgainButton.exists()).toBe(true)
    expect(playAgainButton.text()).toBe('Play Again')
  })

  it('emits playAgain when Play Again is clicked', async () => {
    const wrapper = buildWrapper({ showResults: true })
    await wrapper.find('.glw__start-btn').trigger('click')
    expect(wrapper.emitted('playAgain')).toHaveLength(1)
  })

  it('shows summary slot content in results mode', () => {
    const wrapper = mount(GameLobbyWizard, {
      props: {
        playerName: 'Solo',
        playerColor: '#ff0000',
        isHost: true,
        playerList: [SOLO_PLAYER],
        roomId: 'room-abc',
        matchmakerRoom: 'test-matchmaker',
        configFields: [],
        accentColor: '#4caf50',
        showResults: true
      },
      slots: { summary: '<div class="test-summary">Results</div>' },
      global: { stubs: STUBS }
    })
    expect(wrapper.find('.test-summary').exists()).toBe(true)
  })
})
