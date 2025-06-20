// index.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from 'public' directory
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",  // or specific domain: http://localhost:3000
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join a room
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-joined', socket.id);
  });

  // WebRTC Offer
  socket.on('offer', (data) => {
    socket.to(data.roomId).emit('offer', {
      sdp: data.sdp,
      sender: socket.id
    });
  });

  // WebRTC Answer
  socket.on('answer', (data) => {
    socket.to(data.roomId).emit('answer', {
      sdp: data.sdp,
      sender: socket.id
    });
  });

  // ICE Candidates
  socket.on('ice-candidate', (data) => {
    socket.to(data.roomId).emit('ice-candidate', {
      candidate: data.candidate,
      sender: socket.id
    });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    socket.broadcast.emit('user-left', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});