import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { RoomManager } from './game/RoomManager';
import { TowerType } from './game/Types';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const roomManager = new RoomManager();

app.post('/api/rooms', (req, res) => {
  const roomId = Math.random().toString(36).substring(2, 8);
  roomManager.createRoom(roomId);
  res.json({ roomId });
});

app.get('/api/rooms', (req, res) => {
  const roomsObj: any = {};
  for (const [id, room] of roomManager.getRoomsMap().entries()) {
    roomsObj[id] = { players: room.players.size };
  }
  res.json(roomsObj);
});

app.get('/api/rooms/:roomId', (req, res) => {
  const room = roomManager.getRoom(req.params.roomId);
  if (room) {
    res.json({ exists: true });
  } else {
    res.status(404).json({ exists: false });
  }
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  let currentRoomId: string | null = null;

  socket.on('join_room', (roomId: string) => {
    const room = roomManager.getRoom(roomId);
    if (room) {
      currentRoomId = roomId;
      socket.join(roomId);
      room.addPlayer(socket.id);
      socket.emit('game_state', room.getState());
    } else {
      socket.emit('error', 'Room not found');
    }
  });

  socket.on('place_tower', (data: { x: number, y: number, type: TowerType }) => {
    if (currentRoomId) {
      const room = roomManager.getRoom(currentRoomId);
      if (room) {
        room.placeTower(socket.id, data.x, data.y, data.type);
      }
    }
  });

  // Updated to just take towerId, since stat is no longer used for linear upgrades
  socket.on('upgrade_tower', (data: { towerId: string }) => {
    if (currentRoomId) {
      const room = roomManager.getRoom(currentRoomId);
      if (room) {
        room.upgradeTower(data.towerId, 'NEXT_TIER');
      }
    }
  });

  socket.on('upgrade_clones', () => {
    if (currentRoomId) {
      const room = roomManager.getRoom(currentRoomId);
      if (room) {
        room.upgradeClones();
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (currentRoomId) {
      const room = roomManager.getRoom(currentRoomId);
      if (room) {
        room.removePlayer(socket.id);
      }
    }
  });
});

setInterval(() => {
  const rooms = roomManager.getRoomsMap();
  for (const [roomId, room] of rooms.entries()) {
    if (room.isEmpty()) continue;

    room.update();
    io.to(roomId).emit('game_state', room.getState());
  }
}, 1000 / 60);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
