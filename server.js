import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import path from "path"
import { fileURLToPath } from "url"
import multer from "multer"
import fs from "fs"
import apiRoutes from "./routes/apiRoutes.js"
import { errorHandler, validateJoinRequest, rateLimiter } from "./middleware/errorHandler.js"
import { participants, roomUtils } from "./models/roomModel.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const server = createServer(app)

// Enhanced Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  maxHttpBufferSize: 1e8,
  allowEIO3: true,
  // Enhanced reconnection settings
  connectTimeout: 30000,
  allowUpgrades: true,
  perMessageDeflate: {
    threshold: 1024
  }
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "uploads", "recordings")
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const filename = `recording-${timestamp}-${req.body.roomCode || "unknown"}.webm`
    cb(null, filename)
  },
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
})

// Middleware
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ extended: true, limit: "50mb" }))
app.use(express.static("public"))
app.use("/uploads", express.static(path.join(__dirname, "uploads")))
app.use(rateLimiter)

// API Routes
app.use("/api", apiRoutes)

// Recording upload endpoint
app.post("/api/upload-recording", upload.single("recording"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded" })
    }

    const { roomCode, userEmail, duration, recordingType, participantCount } = req.body

    // Create metadata file
    const metadata = {
      filename: req.file.filename,
      roomCode: roomCode,
      userEmail: userEmail,
      recordingType: recordingType || 'single',
      participantCount: parseInt(participantCount) || 1,
      duration: duration || "unknown",
      fileSize: req.file.size,
      uploadedAt: new Date().toISOString(),
      path: `/uploads/recordings/${req.file.filename}`
    }

    // Save metadata
    const metadataPath = path.join(uploadsDir, `${req.file.filename}.json`)
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))

    console.log(`📹 ${recordingType || 'single'} recording uploaded: ${req.file.filename} by ${userEmail} in room ${roomCode} (${participantCount} participants)`)

    res.json({
      success: true,
      filename: req.file.filename,
      path: `/uploads/recordings/${req.file.filename}`,
      size: req.file.size,
      duration: duration || "unknown",
      recordingType: recordingType || 'single',
      participantCount: participantCount || 1,
      metadata: metadata
    })
  } catch (error) {
    console.error("❌ Error uploading recording:", error)
    res.status(500).json({ success: false, error: "Upload failed" })
  }
})

// Serve the landing page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

// Join room route (renders meeting page)
app.get("/join/:email/:code", validateJoinRequest, (req, res) => {
  const { email, code } = req.params
  const upperCode = code.toUpperCase()

  // Check if room exists, if not create it automatically
  let room = roomUtils.getRoom(upperCode)
  if (!room) {
    room = roomUtils.createRoom(upperCode)
  }

  // Render the meeting page
  res.sendFile(path.join(__dirname, "public", "meeting.html"))
})

// Store socket to user mapping with last activity timestamp
const socketToUser = new Map();
const userToSocket = new Map();
const userLastActivity = new Map();

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("🔌 User connected:", socket.id);
  
  // Track user activity
  function updateUserActivity(userEmail) {
    if (userEmail) {
      userLastActivity.set(userEmail, Date.now());
    }
  }

  // Handle joining room with enhanced error handling and state management
  socket.on("join-room", ({ roomCode, userEmail }) => {
    try {
      console.log(`👤 ${userEmail} attempting to join room ${roomCode}`);
      
      // Clean up any existing session
      const existingSocketId = userToSocket.get(userEmail);
      if (existingSocketId && existingSocketId !== socket.id) {
        const existingSocket = io.sockets.sockets.get(existingSocketId);
        if (existingSocket) {
          console.log(`🔄 Cleaning up existing session for ${userEmail}`);
          existingSocket.disconnect(true);
        }
        socketToUser.delete(existingSocketId);
        userToSocket.delete(userEmail);
      }

      socket.join(roomCode);
      
      // Store user mapping with timestamp
      socketToUser.set(socket.id, { userEmail, roomCode });
      userToSocket.set(userEmail, socket.id);
      updateUserActivity(userEmail);

      // Get or create room
      let room = roomUtils.getRoom(roomCode);
      if (!room) {
        room = roomUtils.createRoom(roomCode);
      }

      // Add participant to room
      room.addParticipant(socket.id, userEmail);

      // Get current participants
      const roomParticipants = Array.from(room.participants)
        .filter((participantId) => participantId !== socket.id)
        .map((participantId) => {
          const participant = participants.get(participantId);
          return {
            socketId: participantId,
            userEmail: participant?.userEmail || "Unknown",
          }
        });

      // Send participants list with delay to ensure proper initialization
      setTimeout(() => {
        socket.emit("room-participants", roomParticipants);
      }, 1000);

      // Notify others
      setTimeout(() => {
        socket.to(roomCode).emit("user-joined", {
          socketId: socket.id,
          userEmail,
        });
      }, 1500);

      // Update room participants count
      io.to(roomCode).emit("participants-update", {
        count: room.participants.size,
        participants: Array.from(room.participants).map((id) => {
          const participant = participants.get(id);
          return {
            socketId: id,
            userEmail: participant?.userEmail || "Unknown",
          }
        }),
      });

      console.log(`✅ ${userEmail} successfully joined room ${roomCode}`);
    } catch (error) {
      console.error("❌ Error joining room:", error);
      socket.emit("error", { message: error.message });
    }
  });

  // Handle ping to keep connection alive
  socket.on("ping", ({ userEmail }) => {
    updateUserActivity(userEmail);
    socket.emit("pong");
  });

  // Handle WebRTC offer
  socket.on("offer", ({ offer, to }) => {
    const sender = socketToUser.get(socket.id)
    console.log(`📤 Offer from ${sender?.userEmail} to ${to}`)

    socket.to(to).emit("offer", {
      offer,
      from: socket.id,
      fromUser: sender?.userEmail,
    })
  })

  // Handle WebRTC answer
  socket.on("answer", ({ answer, to }) => {
    const sender = socketToUser.get(socket.id)
    console.log(`📥 Answer from ${sender?.userEmail} to ${to}`)

    socket.to(to).emit("answer", {
      answer,
      from: socket.id,
      fromUser: sender?.userEmail,
    })
  })

  // Handle ICE candidates
  socket.on("ice-candidate", ({ candidate, to }) => {
    const sender = socketToUser.get(socket.id)
    console.log(`🧊 ICE candidate from ${sender?.userEmail} to ${to}`)

    socket.to(to).emit("ice-candidate", {
      candidate,
      from: socket.id,
      fromUser: sender?.userEmail,
    })
  })

  // Handle group chat messages
  socket.on("chat-message", ({ message, senderEmail, roomCode }) => {
    const room = roomUtils.getRoom(roomCode)
    if (room) {
      const messageObj = room.addMessage(message, senderEmail)

      // Broadcast to all participants in the room
      io.to(roomCode).emit("chat-message", messageObj)

      console.log(`💬 Group chat message from ${senderEmail} in room ${roomCode}`)
    }
  })

  // Handle private chat messages
  socket.on("private-message", ({ message, senderEmail, recipientEmail, roomCode }) => {
    const recipientSocketId = userToSocket.get(recipientEmail)
    const senderSocketId = socket.id

    if (recipientSocketId) {
      const messageObj = {
        id: Date.now() + Math.random(),
        message,
        senderEmail,
        recipientEmail,
        timestamp: new Date().toISOString(),
        type: "private",
      }

      // Send to recipient
      socket.to(recipientSocketId).emit("private-message", messageObj)

      // Send back to sender for confirmation
      socket.emit("private-message", messageObj)

      console.log(`🔒 Private message from ${senderEmail} to ${recipientEmail}`)
    } else {
      socket.emit("error", { message: "Recipient not found" })
    }
  })

  // Handle media state changes
  socket.on("media-state-change", ({ type, enabled, roomCode }) => {
    const user = socketToUser.get(socket.id)
    if (user) {
      socket.to(roomCode).emit("user-media-state-changed", {
        socketId: socket.id,
        userEmail: user.userEmail,
        type, // 'audio' or 'video'
        enabled,
      })
    }
  })

  // Handle screen sharing
  socket.on("screen-share-start", ({ roomCode }) => {
    const user = socketToUser.get(socket.id)
    if (user) {
      socket.to(roomCode).emit("user-screen-share-started", {
        socketId: socket.id,
        userEmail: user.userEmail,
      })
    }
  })

  socket.on("screen-share-stop", ({ roomCode }) => {
    const user = socketToUser.get(socket.id)
    if (user) {
      socket.to(roomCode).emit("user-screen-share-stopped", {
        socketId: socket.id,
        userEmail: user.userEmail,
      })
    }
  })

  // Handle recording events
  socket.on("recording-started", ({ roomCode, type = 'single' }) => {
    const user = socketToUser.get(socket.id)
    if (user) {
      socket.to(roomCode).emit("user-recording-started", {
        socketId: socket.id,
        userEmail: user.userEmail,
        recordingType: type,
      })
      
      console.log(`📹 ${user.userEmail} started ${type} recording in room ${roomCode}`)
    }
  })

  socket.on("recording-stopped", ({ roomCode, filename, recordingType = 'single' }) => {
    const user = socketToUser.get(socket.id)
    if (user) {
      socket.to(roomCode).emit("user-recording-stopped", {
        socketId: socket.id,
        userEmail: user.userEmail,
        filename,
        recordingType,
      })
      
      console.log(`📹 ${user.userEmail} stopped ${recordingType} recording: ${filename}`)
    }
  })

  // Enhanced disconnect handling
  socket.on("disconnect", (reason) => {
    console.log("🔌 User disconnected:", socket.id, "Reason:", reason)

    const user = socketToUser.get(socket.id)
    if (user) {
      const { roomCode, userEmail } = user
      const room = roomUtils.getRoom(roomCode)

      if (room) {
        // Don't remove participant immediately in case of temporary disconnection
        setTimeout(() => {
          // Check if user has reconnected with a new socket
          const currentSocketId = userToSocket.get(userEmail)
          if (currentSocketId === socket.id) {
            const remainingCount = room.removeParticipant(socket.id)

            // Notify others in the room
            socket.to(roomCode).emit("user-left", {
              socketId: socket.id,
              userEmail,
            })

            // Update participants count
            io.to(roomCode).emit("participants-update", {
              count: remainingCount,
              participants: Array.from(room.participants).map((id) => {
                const participant = participants.get(id)
                return {
                  socketId: id,
                  userEmail: participant?.userEmail || "Unknown",
                }
              }),
            })

            console.log(`👋 ${userEmail} left room ${roomCode}`)
            
            // Clean up mappings
            socketToUser.delete(socket.id)
            userToSocket.delete(userEmail)
            userLastActivity.delete(userEmail)
          }
        }, 5000); // Wait 5 seconds before removing participant
      }
    }
  })

  // Handle connection errors
  socket.on("connect_error", (error) => {
    console.error("❌ Socket connection error:", error)
  })
})

// Error handling middleware
app.use(errorHandler)

const PORT = process.env.PORT || 5055
server.listen(PORT, () => {
  console.log(`🚀 Google Meet Clone server running on port ${PORT}`)
  console.log(`📱 Access the app at: http://localhost:${PORT}`)
  console.log(`🔗 Join meetings at: http://localhost:${PORT}/join/user@example.com/ROOM123`)
  console.log(`📁 Recordings saved to: ${uploadsDir}`)
})

export default app
