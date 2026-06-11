import { createServer } from 'http'
import { Server, Socket } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ─── Types ───────────────────────────────────────────────────────────

interface CollabUser {
  socketId: string
  userId: string
  userName: string
  cursorX: number
  cursorY: number
  selectedElementId?: string
  color: string
}

interface RoomState {
  users: Map<string, CollabUser>
  designTree: unknown | null
}

// ─── State ───────────────────────────────────────────────────────────

const rooms = new Map<string, RoomState>()

// Palette of distinct colors for user cursors
const CURSOR_COLORS = [
  '#f43f5e', // rose
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#e11d48', // rose-600
]

let colorIndex = 0

function getNextColor(): string {
  const color = CURSOR_COLORS[colorIndex % CURSOR_COLORS.length]
  colorIndex++
  return color
}

function getOrCreateRoom(projectId: string): RoomState {
  let room = rooms.get(projectId)
  if (!room) {
    room = { users: new Map(), designTree: null }
    rooms.set(projectId, room)
  }
  return room
}

// ─── Socket Handlers ─────────────────────────────────────────────────

io.on('connection', (socket: Socket) => {
  console.log(`[collab] Connected: ${socket.id}`)

  // Track which room this socket is in
  let currentProjectId: string | null = null
  let currentUserId: string | null = null

  // ── join-project ─────────────────────────────────────────────────
  socket.on(
    'join-project',
    (data: { projectId: string; userId: string; userName: string }) => {
      const { projectId, userId, userName } = data

      // Leave previous room if any
      if (currentProjectId) {
        const prevRoom = rooms.get(currentProjectId)
        if (prevRoom) {
          prevRoom.users.delete(socket.id)
          socket.leave(currentProjectId)
          io.to(currentProjectId).emit('user-left', {
            userId: currentUserId,
            socketId: socket.id,
          })
          // Clean up empty rooms
          if (prevRoom.users.size === 0) {
            rooms.delete(currentProjectId)
          }
        }
      }

      currentProjectId = projectId
      currentUserId = userId

      const room = getOrCreateRoom(projectId)
      const color = getNextColor()

      const collabUser: CollabUser = {
        socketId: socket.id,
        userId,
        userName,
        cursorX: 0,
        cursorY: 0,
        color,
      }

      room.users.set(socket.id, collabUser)
      socket.join(projectId)

      // Broadcast to the room that a user joined
      io.to(projectId).emit('user-joined', {
        userId,
        userName,
        color,
        socketId: socket.id,
      })

      // Send the joining user the current room state
      const usersList = Array.from(room.users.values()).map((u) => ({
        userId: u.userId,
        userName: u.userName,
        cursorX: u.cursorX,
        cursorY: u.cursorY,
        selectedElementId: u.selectedElementId,
        color: u.color,
      }))

      socket.emit('project-state', {
        users: usersList,
        designTree: room.designTree,
      })

      console.log(
        `[collab] ${userName} (${userId}) joined project ${projectId}. Room size: ${room.users.size}`
      )
    }
  )

  // ── leave-project ────────────────────────────────────────────────
  socket.on('leave-project', () => {
    if (!currentProjectId) return

    const room = rooms.get(currentProjectId)
    if (room) {
      room.users.delete(socket.id)
      socket.leave(currentProjectId)

      io.to(currentProjectId).emit('user-left', {
        userId: currentUserId,
        socketId: socket.id,
      })

      // Clean up empty rooms
      if (room.users.size === 0) {
        rooms.delete(currentProjectId)
      }

      console.log(
        `[collab] User ${currentUserId} left project ${currentProjectId}. Room size: ${room.users.size}`
      )
    }

    currentProjectId = null
    currentUserId = null
  })

  // ── cursor-move ──────────────────────────────────────────────────
  socket.on(
    'cursor-move',
    (data: { projectId: string; userId: string; x: number; y: number }) => {
      const { projectId, userId, x, y } = data
      const room = rooms.get(projectId)
      if (!room) return

      const user = room.users.get(socket.id)
      if (user) {
        user.cursorX = x
        user.cursorY = y
      }

      // Broadcast to OTHER users in the room
      socket.to(projectId).emit('cursor-update', {
        userId,
        x,
        y,
        color: user?.color,
      })
    }
  )

  // ── design-update ────────────────────────────────────────────────
  socket.on(
    'design-update',
    (data: { projectId: string; userId: string; designTree: unknown }) => {
      const { projectId, userId, designTree } = data
      const room = rooms.get(projectId)
      if (!room) return

      // Store the latest design state
      room.designTree = designTree

      // Broadcast to OTHER users in the room
      socket.to(projectId).emit('design-changed', {
        userId,
        designTree,
      })
    }
  )

  // ── comment-added ────────────────────────────────────────────────
  socket.on(
    'comment-added',
    (data: { projectId: string; userId: string; annotation: unknown }) => {
      const { projectId, userId, annotation } = data

      // Broadcast to ALL users in the room (including sender for confirmation)
      io.to(projectId).emit('new-comment', {
        userId,
        annotation,
        timestamp: Date.now(),
      })
    }
  )

  // ── comment-resolved ─────────────────────────────────────────────
  socket.on(
    'comment-resolved',
    (data: { projectId: string; userId: string; commentId: string }) => {
      const { projectId, userId, commentId } = data

      io.to(projectId).emit('comment-update', {
        userId,
        commentId,
        resolved: true,
        timestamp: Date.now(),
      })
    }
  )

  // ── element-selected ─────────────────────────────────────────────
  socket.on(
    'element-selected',
    (data: { projectId: string; userId: string; elementId: string }) => {
      const { projectId, userId, elementId } = data
      const room = rooms.get(projectId)
      if (!room) return

      const user = room.users.get(socket.id)
      if (user) {
        user.selectedElementId = elementId
      }

      // Broadcast to OTHER users
      socket.to(projectId).emit('selection-update', {
        userId,
        elementId,
        color: user?.color,
      })
    }
  )

  // ── chat-message ─────────────────────────────────────────────────
  socket.on(
    'chat-message',
    (data: {
      projectId: string
      userId: string
      userName: string
      content: string
    }) => {
      const { projectId, userId, userName, content } = data

      io.to(projectId).emit('new-chat-message', {
        userId,
        userName,
        content,
        timestamp: Date.now(),
      })
    }
  )

  // ── disconnect ───────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    console.log(`[collab] Disconnected: ${socket.id} (${reason})`)

    if (currentProjectId) {
      const room = rooms.get(currentProjectId)
      if (room) {
        room.users.delete(socket.id)

        io.to(currentProjectId).emit('user-left', {
          userId: currentUserId,
          socketId: socket.id,
        })

        // Clean up empty rooms
        if (room.users.size === 0) {
          rooms.delete(currentProjectId)
          console.log(
            `[collab] Room ${currentProjectId} is empty, cleaned up`
          )
        }
      }
    }
  })

  // ── error ────────────────────────────────────────────────────────
  socket.on('error', (error: Error) => {
    console.error(`[collab] Socket error (${socket.id}):`, error)
  })
})

// ─── Start Server ────────────────────────────────────────────────────

const PORT = 3003

httpServer.listen(PORT, () => {
  console.log(`[collab] Z.Design Collaboration service running on port ${PORT}`)
})

// ─── Graceful Shutdown ───────────────────────────────────────────────

function shutdown() {
  console.log('[collab] Shutting down collaboration service...')
  io.disconnectSockets(true)
  httpServer.close(() => {
    console.log('[collab] Server closed')
    process.exit(0)
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
