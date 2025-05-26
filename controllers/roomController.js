import { rooms, participants } from "../models/roomModel.js"

// Room Controller - Only for joining existing rooms
export class RoomController {
  // Join an existing room
  static async joinRoom(req, res) {
    try {
      const { email, code } = req.params

      // Validate input
      if (!email || !code) {
        return res.status(400).json({
          success: false,
          error: "Email and meeting code are required",
        })
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          error: "Invalid email format",
        })
      }

      // Check if room exists
      const room = rooms.get(code.toUpperCase())
      if (!room) {
        return res.status(404).json({
          success: false,
          error: "Meeting room not found. Please check the meeting code.",
        })
      }

      // Check room capacity
      const MAX_PARTICIPANTS = 50
      if (room.participants.size >= MAX_PARTICIPANTS) {
        return res.status(403).json({
          success: false,
          error: "Meeting room is full. Maximum participants reached.",
        })
      }

      // Return room information for joining
      res.json({
        success: true,
        data: {
          roomCode: code.toUpperCase(),
          roomId: room.id,
          participantCount: room.participants.size,
          createdAt: room.createdAt,
          userEmail: email,
          canJoin: true,
        },
        message: "Room found. Ready to join.",
      })
    } catch (error) {
      console.error("Error in joinRoom:", error)
      res.status(500).json({
        success: false,
        error: "Internal server error",
      })
    }
  }

  // Get room information
  static async getRoomInfo(req, res) {
    try {
      const { code } = req.params

      if (!code) {
        return res.status(400).json({
          success: false,
          error: "Meeting code is required",
        })
      }

      const room = rooms.get(code.toUpperCase())
      if (!room) {
        return res.status(404).json({
          success: false,
          error: "Meeting room not found",
        })
      }

      res.json({
        success: true,
        data: {
          code: code.toUpperCase(),
          participantCount: room.participants.size,
          createdAt: room.createdAt,
          isActive: room.participants.size > 0,
          maxParticipants: 50,
        },
      })
    } catch (error) {
      console.error("Error in getRoomInfo:", error)
      res.status(500).json({
        success: false,
        error: "Internal server error",
      })
    }
  }

  // Get all active rooms
  static async getActiveRooms(req, res) {
    try {
      const activeRooms = Array.from(rooms.entries())
        .filter(([code, room]) => room.participants.size > 0)
        .map(([code, room]) => ({
          code,
          participantCount: room.participants.size,
          createdAt: room.createdAt,
          isActive: true,
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

      res.json({
        success: true,
        data: activeRooms,
        total: activeRooms.length,
      })
    } catch (error) {
      console.error("Error in getActiveRooms:", error)
      res.status(500).json({
        success: false,
        error: "Internal server error",
      })
    }
  }

  // Get system statistics
  static async getStats(req, res) {
    try {
      const totalRooms = rooms.size
      const activeRooms = Array.from(rooms.values()).filter((room) => room.participants.size > 0).length
      const totalParticipants = participants.size

      res.json({
        success: true,
        data: {
          totalRooms,
          activeRooms,
          totalParticipants,
          timestamp: new Date().toISOString(),
          status: "operational",
        },
      })
    } catch (error) {
      console.error("Error in getStats:", error)
      res.status(500).json({
        success: false,
        error: "Internal server error",
      })
    }
  }
}
