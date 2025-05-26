import express from "express"
import { RoomController } from "../controllers/roomController.js"

const router = express.Router()

// Room joining routes
router.get("/join/:email/:code", RoomController.joinRoom)
router.get("/room/:code", RoomController.getRoomInfo)
router.get("/rooms", RoomController.getActiveRooms)
router.get("/stats", RoomController.getStats)

// Health check
router.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "Google Meet Clone API",
    version: "1.0.0",
  })
})

export default router
