import type { Server, ServerOptions } from 'socket.io'
import type { Server as HttpServer } from 'node:http'

export interface PlayerPosition {
  x: number
  y: number
  z: number
}

export interface PlayerRotation {
  x: number
  y: number
  z: number
}

export interface PlayerState {
  id: string
  name: string
  position: PlayerPosition
  rotation: PlayerRotation
}

export interface MultiplayerServerConfig {
  /** Called when a player connects, returns initial data to send them */
  onConnect?: (socketId: string) => Record<string, unknown>
  /** CORS policy handed to Socket.IO, default: `{ origin: '*' }` */
  cors?: ServerOptions['cors']
}

export interface MultiplayerServerHandle {
  /** The Socket.IO server */
  server: Server
  /** The HTTP server it rides on — call `listen()` on this to start accepting players */
  httpServer: HttpServer
  /** Stop listening, drop every handler, and empty the registry */
  cleanup: () => void
}
