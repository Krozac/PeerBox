const WebSocket = require('ws');
const config = require('./config');
const { detokenise } = require("./utils/token"); // your util
const startApi = require('./api');
const generateRoomId = require('./utils/generateRoomId');
const { v4: uuidv4 } = require('uuid');

const rooms = {};
const wss = new WebSocket.Server({ port: config.server.port });

/* ======================
   HANDLERS
====================== */
function handleCreate(ws, data) {
  let roomId;
  do {
    roomId = generateRoomId();
  } while (rooms[roomId]);

  rooms[roomId] = { host: ws, clients: [], gameId: data?.gameId || null };

  const clientId = uuidv4();
  ws.role = 'host';
  ws.roomId = roomId;
  ws.clientId = clientId;

  ws.send(JSON.stringify({ 
    type: 'room-created', 
    roomId, 
    clientId, 
    gameId: data?.gameId || null 
  }));
}

function handleHostDisconnect(data) {
  if (data.roomId && rooms[data.roomId]) {
    delete rooms[data.roomId];
    console.log(`[Room ${data.roomId}] deleted (host disconnected)`);
  }
}

function handleClientDisconnect(ws, data) {
  if (data.roomId && rooms[data.roomId]) {
    const room = rooms[data.roomId];
    room.clients = room.clients.filter(client => client !== ws);
    console.log(
      `Client left room ${data.roomId}. ${room.clients.length} client(s) remain.`
    );
  }
}

async function handleJoin(ws, data) {
  const token = data.token;
  if (!token) return;
  let joinContext = await detokenise(config.SECRET, token);
  const roomId = joinContext.roomId;
  const username = joinContext.username;
  const room = rooms[roomId];
  if (!room) return;

  // Try to reuse existing ID if provided
  let clientId = data.clientId || uuidv4();

  // Check if reconnecting (same clientId)
  const existing = room.clients.find(c => c.clientId === clientId);
  if (existing) {
    console.log(`[Client] Reconnecting ${clientId} (${username})`);
    existing.close(); // Clean up old socket if still around
    room.clients = room.clients.filter(c => c !== existing);
  }

  // Register new socket
  ws.role = 'client';
  ws.roomId = roomId;
  ws.clientId = clientId;
  room.clients.push(ws);

  room.host.send(JSON.stringify({ type: 'new-peer', clientId, username }));
  ws.send(JSON.stringify({ type: 'join-accepted', roomId, clientId, username }));
}


function handleSignal(ws, data) {
  const room = rooms[ws.roomId];
  if (!room) return;

  const signalingMessage = data.payload;
  console.log(signalingMessage)
  const targetClientId = signalingMessage.target;

  if (targetClientId === 'host') {
    room.host.send(
      JSON.stringify({ type: 'signal', payload: signalingMessage, from: ws.clientId })
    );
  } else {
    const targetClient = room.clients.find(c => c.clientId === targetClientId);
    if (targetClient) {
      targetClient.send(
        JSON.stringify({ type: 'signal', payload: signalingMessage, from: ws.clientId })
      );
    }
  }
}

/* ======================
   CONNECTION LOGIC
====================== */
wss.on('connection', (ws) => {
  ws.role = null;
  ws.roomId = null;

  ws.on('message', (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch (err) {
      console.warn('Invalid JSON received:', msg);
      return;
    }

    console.log(data.type);
    switch (data.type) {
      case 'create':
        handleCreate(ws,data);
        break;
      case 'host-disconnected':
        handleHostDisconnect(data);
        break;
      case 'client-disconnected':
        handleClientDisconnect(ws, data);
        break;
      case 'join':
        handleJoin(ws, data);
        break;
      case 'signal':
        handleSignal(ws, data);
        break;
      default:
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
        break;
    }
  });

  ws.on('close', () => {
    const { roomId, role } = ws;
    if (!roomId || !rooms[roomId]) return;

    const room = rooms[roomId];

    if (role === 'host') {
      delete rooms[roomId];
      console.log(`[Room ${roomId}] deleted (host disconnected)`);
    } else if (role === 'client') {
      room.clients = room.clients.filter(client => client !== ws);
      room.host.send(JSON.stringify({ type: 'peer-left', clientId: ws.clientId }));
      console.log(
        `Client left room ${roomId}. ${room.clients.length} client(s) remain.`
      );
    }
  });
});

console.log(`Signaling server running on ws://localhost:${config.server.port}`);

startApi(rooms, config);