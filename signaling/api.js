const express = require('express');
const cors = require('cors'); 
const { tokenise } = require("./utils/token"); // your util
const config = require('./config');
const SECRET = config.SECRET;

function startApi(rooms, config) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  const apiPort = config.api.port || 5502;

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // Stats about rooms/clients
  app.get('/stats', (req, res) => {
    const roomStats = Object.entries(rooms).map(([roomId, room]) => ({
      roomId,
      clients: room.clients.length,
    }));

    const totalClients = Object.values(rooms).reduce(
      (sum, room) => sum + room.clients.length,
      0
    );

    res.json({
      totalRooms: Object.keys(rooms).length,
      totalClients,
    });
  });

  //config games -> url mappings
  app.get('/games',(req, res) => {
    res.json({
      games:config.games,
    })
  })

  app.get('/rooms/:roomId', (req, res) => {
  const roomId = req.params.roomId;
  const room = rooms[roomId];

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  res.json({
    roomId,
    clientCount: room.clients.length,
    maxClients: config.rooms.maxClients,
    gameUrl: config.games[room.gameId] || null,
  });
});

app.post("/token", async (req, res) => {
  const { roomId, username } = req.body;

  if (!roomId || !username) {
    return res.status(400).json({ error: "roomId and username required" });
  }

  if (username.length > 16) {
    return res.status(400).json({ error: "Username too long" });
  }

  const room = rooms[roomId];
  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }

  // resolve game URL from config
  const gameUrl = room.gameId ? config.games[room.gameId] : null;

  try {
    const token = await tokenise(SECRET, {
      roomId,
      username,
      exp: Math.floor(Date.now() / 1000) + 60 * 5, // 5 minutes expiry
    });

    res.json({ token, gameUrl });
  } catch (err) {
    console.error("Token error:", err);
    res.status(500).json({ error: "Failed to create token" });
  }
});


  app.listen(apiPort, () => {
    console.log(`Stats API running on http://localhost:${apiPort}`);
  });
}



module.exports = startApi;
