import { p2pJoin, p2pLeave, p2pGetPeerIds, p2pOnPeerJoin, p2pOnPeerLeave } from './room'
import type { P2PConfig, P2PSession } from './types'

const REQUEST_CHANNEL = 'lobby-req'
const RESPONSE_CHANNEL = 'lobby-res'
const NAME_CHANNEL = 'lobby-name'

export interface MatchRequest {
  requestId: string
  gameRoomId: string
}

type RequestPayload = { requestId: string; gameRoomId: string } & Record<string, string>
type ResponsePayload = { requestId: string; accepted: string } & Record<string, string>
type NamePayload = { name: string } & Record<string, string>

export interface LobbyCallbacks {
  /** A new peer appeared in the lobby */
  onPeerJoin: (peerId: string) => void
  /** A peer left the lobby */
  onPeerLeave: (peerId: string) => void
  /** Another peer sent us a match request */
  onRequest: (request: MatchRequest, fromPeerId: string) => void
  /** The peer we requested accepted the match */
  onAccepted: (requestId: string) => void
  /** The peer we requested ignored the match */
  onIgnored: (requestId: string) => void
  /** A peer broadcast their display name */
  onPeerName: (peerId: string, name: string) => void
}

export interface LobbyHandle {
  session: P2PSession
  /** IDs of all peers currently in the lobby */
  getPeerIds: () => string[]
  /** Broadcast a display name to all current peers and auto-send it to future joiners */
  setName: (name: string) => void
  /** Send a match request to a specific peer — returns the request for tracking */
  sendRequest: (targetPeerId: string) => MatchRequest
  /** Accept an incoming match request */
  acceptRequest: (request: MatchRequest, fromPeerId: string) => void
  /** Ignore an incoming match request */
  ignoreRequest: (request: MatchRequest, fromPeerId: string) => void
  /** Leave the lobby and clean up */
  stop: () => void
}

/**
 * Join a lobby room for peer discovery and match negotiation.
 *
 * Peers in the lobby can broadcast a display name, send targeted match
 * requests to each other, and accept or ignore each request individually.
 * On acceptance, both sides receive the shared `gameRoomId` to join.
 *
 * @param lobbyRoomId - Well-known room ID all players join to discover each other
 * @param config - Optional P2P configuration
 * @param callbacks - Event handlers for peer, name, and request lifecycle events
 * @returns A handle to set a name, send requests, respond, and leave the lobby
 */
export const p2pLobbyJoin = (
  lobbyRoomId: string,
  config: P2PConfig | undefined,
  callbacks: LobbyCallbacks
): LobbyHandle => {
  const session = p2pJoin(lobbyRoomId, config)

  const [sendRequest, onRequest] = session.room.makeAction<RequestPayload>(REQUEST_CHANNEL)
  const [sendResponse, onResponse] = session.room.makeAction<ResponsePayload>(RESPONSE_CHANNEL)
  const [sendName, onName] = session.room.makeAction<NamePayload>(NAME_CHANNEL)

  let localName = ''

  p2pOnPeerJoin(session, (peerId) => {
    if (localName) sendName({ name: localName }, peerId)
    callbacks.onPeerJoin(peerId)
  })

  p2pOnPeerLeave(session, callbacks.onPeerLeave)

  onRequest((payload: RequestPayload, fromPeerId: string) => {
    callbacks.onRequest(
      { requestId: payload.requestId, gameRoomId: payload.gameRoomId },
      fromPeerId
    )
  })

  onResponse((payload: ResponsePayload) => {
    if (payload.accepted === 'true') {
      callbacks.onAccepted(payload.requestId)
    } else {
      callbacks.onIgnored(payload.requestId)
    }
  })

  onName((payload: NamePayload, fromPeerId: string) => {
    callbacks.onPeerName(fromPeerId, payload.name)
  })

  return {
    session,
    getPeerIds: () => p2pGetPeerIds(session),
    setName: (name: string): void => {
      localName = name
      sendName({ name })
    },
    sendRequest: (targetPeerId: string): MatchRequest => {
      const requestId = `${session.peerId}-${Date.now()}`
      const gameRoomId = `${lobbyRoomId}-game-${requestId}`
      const payload: RequestPayload = { requestId, gameRoomId }
      sendRequest(payload, targetPeerId)
      return { requestId, gameRoomId }
    },
    acceptRequest: (request: MatchRequest, fromPeerId: string): void => {
      const payload: ResponsePayload = { requestId: request.requestId, accepted: 'true' }
      sendResponse(payload, fromPeerId)
    },
    ignoreRequest: (request: MatchRequest, fromPeerId: string): void => {
      const payload: ResponsePayload = { requestId: request.requestId, accepted: 'false' }
      sendResponse(payload, fromPeerId)
    },
    stop: () => p2pLeave(session)
  }
}
