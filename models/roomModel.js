// In-memory storage for rooms and participants
export const rooms = new Map()
export const participants = new Map()

// Room model class
export class Room {
  constructor(code) {
    this.id = code
    this.code = code.toUpperCase()
    this.participants = new Set()
    this.createdAt = new Date()
    this.messages = []
    this.isActive = true
    this.maxParticipants = 50
  }

  // Add participant to room
  addParticipant(socketId, userEmail) {
    if (this.participants.size >= this.maxParticipants) {
      throw new Error("Room is full")
    }

    this.participants.add(socketId)
    participants.set(socketId, {
      userEmail,
      roomCode: this.code,
      joinedAt: new Date(),
    })

    return true
  }

  // Remove participant from room
  removeParticipant(socketId) {
    this.participants.delete(socketId)
    participants.delete(socketId)

    // Mark room as inactive if empty
    if (this.participants.size === 0) {
      this.isActive = false
    }

    return this.participants.size
  }

  // Add message to room
  addMessage(message, senderEmail) {
    const messageObj = {
      id: Date.now() + Math.random(),
      message,
      senderEmail,
      timestamp: new Date().toISOString(),
    }

    this.messages.push(messageObj)

    // Keep only last 100 messages
    if (this.messages.length > 100) {
      this.messages = this.messages.slice(-100)
    }

    return messageObj
  }

  // Get room info
  getInfo() {
    return {
      code: this.code,
      participantCount: this.participants.size,
      createdAt: this.createdAt,
      isActive: this.isActive,
      maxParticipants: this.maxParticipants,
      messageCount: this.messages.length,
    }
  }
}

// Utility functions
export const roomUtils = {
  // Create a new room
  createRoom(code) {
    const upperCode = code.toUpperCase()
    if (rooms.has(upperCode)) {
      return rooms.get(upperCode)
    }

    const room = new Room(upperCode)
    rooms.set(upperCode, room)
    console.log(`Room ${upperCode} created`)
    return room
  },

  // Get room by code
  getRoom(code) {
    return rooms.get(code.toUpperCase())
  },

  // Check if room exists
  roomExists(code) {
    return rooms.has(code.toUpperCase())
  },

  // Clean up empty rooms
  cleanupEmptyRooms() {
    for (const [code, room] of rooms.entries()) {
      if (room.participants.size === 0 && !room.isActive) {
        rooms.delete(code)
        console.log(`Cleaned up empty room: ${code}`)
      }
    }
  },

  // Get all active rooms
  getActiveRooms() {
    return Array.from(rooms.entries())
      .filter(([code, room]) => room.participants.size > 0)
      .map(([code, room]) => room.getInfo())
  },
}

// Auto cleanup empty rooms every 5 minutes
setInterval(
  () => {
    roomUtils.cleanupEmptyRooms()
  },
  5 * 60 * 1000,
)
