# Google Meet Clone

A complete Google Meet clone with WebRTC, Socket.io, and all meeting features.

## Features

- 📹 **HD Video Calling** - Crystal clear video with multiple participants
- 🎤 **Audio Controls** - Mute/unmute with noise cancellation
- 🖥️ **Screen Sharing** - Share your screen with participants
- 💬 **Live Chat** - Real-time messaging during meetings
- 📱 **Mobile Responsive** - Works on all devices
- 🔒 **Secure** - Peer-to-peer encrypted connections

## Quick Start

1. **Install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

2. **Start the server:**
   \`\`\`bash
   npm start
   \`\`\`

3. **Open your browser:**
   \`\`\`
   http://localhost:3000
   \`\`\`

4. **Join a meeting:**
   \`\`\`
   http://localhost:3000/join/user@email.com/ROOM123
   \`\`\`

## API Endpoints

- `GET /api/stats` - Get system statistics
- `GET /api/rooms` - Get active rooms
- `GET /api/room/:code` - Get room information
- `GET /api/join/:email/:code` - Join room validation

## Development

\`\`\`bash
# Development mode with auto-reload
npm run dev

# Production build
npm run build
npm start
\`\`\`

## Deployment

### Vercel
\`\`\`bash
vercel --prod
\`\`\`

### Docker
\`\`\`bash
docker build -t google-meet-clone .
docker run -p 3000:3000 google-meet-clone
\`\`\`

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

## Tech Stack

- **Backend:** Node.js, Express.js, Socket.io
- **Frontend:** HTML5, CSS3, JavaScript (ES6+)
- **WebRTC:** Peer-to-peer video/audio
- **Real-time:** Socket.io for signaling

## License

MIT License
