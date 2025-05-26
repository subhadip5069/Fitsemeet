// Error handling middleware
export const errorHandler = (err, req, res, next) => {
  console.error("Error:", err)

  // Default error
  const error = {
    success: false,
    error: "Internal server error",
  }

  // Validation errors
  if (err.name === "ValidationError") {
    error.error = "Validation failed"
    error.details = err.message
  }

  // Room not found
  if (err.message === "Room not found") {
    return res.status(404).json({
      success: false,
      error: "Meeting room not found",
    })
  }

  // Room full
  if (err.message === "Room is full") {
    return res.status(403).json({
      success: false,
      error: "Meeting room is full",
    })
  }

  res.status(500).json(error)
}

// Request validation middleware
export const validateJoinRequest = (req, res, next) => {
  const { email, code } = req.params

  if (!email || !code) {
    return res.status(400).json({
      success: false,
      error: "Email and meeting code are required",
    })
  }

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: "Invalid email format",
    })
  }

  // Validate code format
  const codeRegex = /^[A-Z0-9]{3,12}$/i
  if (!codeRegex.test(code)) {
    return res.status(400).json({
      success: false,
      error: "Invalid meeting code format",
    })
  }

  next()
}

// Rate limiting middleware
export const rateLimiter = (req, res, next) => {
  // Simple rate limiting
  const ip = req.ip
  const now = Date.now()

  if (!global.rateLimitStore) {
    global.rateLimitStore = new Map()
  }

  const userRequests = global.rateLimitStore.get(ip) || []
  const recentRequests = userRequests.filter((time) => now - time < 60000) // 1 minute

  if (recentRequests.length >= 30) {
    // 30 requests per minute
    return res.status(429).json({
      success: false,
      error: "Too many requests. Please try again later.",
    })
  }

  recentRequests.push(now)
  global.rateLimitStore.set(ip, recentRequests)

  next()
}
