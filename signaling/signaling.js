const WebSocket = require('ws');
const config = require('./config');
const { detokenise } = require("./utils/token"); // your util
const startApi = require('./api');
const generateRoomId = require('./utils/generateRoomId');
const { v4: uuidv4 } = require('uuid');

const rooms = {}; // { roomId: { host: WebSocket, clients: Map<userId, WebSocket>, gameId: string } }
const wss = new WebSocket.Server({ port: config.server.port });
const pendingDisconnects = new Map(); // userId -> timeout

/* ======================
   HANDLERS
====================== */
function handleCreate(ws, data) {
  let roomId;
  do {
    roomId = generateRoomId();
  } while (rooms[roomId]);

  rooms[roomId] = { host: ws, clients: new Map(), gameId: data?.gameId || null };

  const userId = uuidv4();
  ws.role = 'host';
  ws.roomId = roomId;
  ws.userId = userId;

  ws.send(JSON.stringify({ 
    type: 'room-created', 
    roomId, 
    userId, 
    gameId: data?.gameId || null 
  }));
}

function handleHostDisconnect(data) {
  if (data.roomId && rooms[data.roomId]) {
    delete rooms[data.roomId];
    console.log(`[Room ${data.roomId}] deleted (host disconnected)`);
  }
}

function handleClientDisconnect(ws, data) { // intentional disconnect client sent this before closing connection
  if (data.roomId && rooms[data.roomId]) {

    const userId = ws.userId;
    const room = rooms[data.roomId];

    room.clients.delete(userId);

    room.host.send(JSON.stringify({ type: 'peer-left', userId }));
    console.log(`Client ${userId} intentionally left room ${data.roomId}. ${room.clients.size} client(s) remain.`);
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
  let userId = data.userId || uuidv4();
  let connectionId = uuidv4();

  // Check if reconnecting (same userId)
  const reconnectTimeout = pendingDisconnects.get(userId);
  const isReconnect = !!reconnectTimeout;

  console.log(data);
  console.log(`User ${username} (${userId}) is joining room ${roomId} ${isReconnect ? '(reconnecting)' : ''}`);

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    pendingDisconnects.delete(userId);
  }

  // Register new socket
  ws.role = 'client';
  ws.roomId = roomId;
  ws.userId = userId;
  ws.connectionId = connectionId;

  room.clients.set(userId, ws);

  room.host.send(JSON.stringify({
    type: isReconnect ? 'peer-reconnected' : 'new-peer',
    userId,
    username
  }));
  
  ws.send(JSON.stringify({ type: 'join-accepted', roomId, userId, username }));
}


function handleSignal(ws, data) {
  const room = rooms[ws.roomId];
  if (!room) return;

  const signalingMessage = data.payload;

  const targetUserId = signalingMessage.target;

  console.log(`Signaling message from ${ws.userId} to ${targetUserId}:`, signalingMessage);

  if (targetUserId === 'host') {
    room.host.send(
      JSON.stringify({ type: 'signal', payload: signalingMessage, from: ws.userId })
    );
  } else {
    const targetClient = room.clients.get(targetUserId);
    if (targetClient) {
      targetClient.send(
        JSON.stringify({ type: 'signal', payload: signalingMessage, from: ws.userId })
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
    } else if (role === 'client') { // disconnection could be temporary, wait a bit before notifying host and removing from room

      const userId = ws.userId;

      const timeout = setTimeout(() => {
        room.clients.delete(userId);

        room.host.send(JSON.stringify({ type: 'peer-left', userId: ws.userId }));

        pendingDisconnects.delete(userId);

        console.log(
          `Client ${userId} disconnected from room ${roomId}. ${room.clients.size} client(s) remain.`
        );
      }, config.reconnectGracePeriod);  

      pendingDisconnects.set(userId, timeout);

      room.host.send(JSON.stringify({ type: 'peer-disconnected', userId: ws.userId }));
      console.log(
        `Client ${userId} temporarily disconnected from room ${roomId}. Waiting for reconnection...`
      );
    }
  });
});

console.log(`Signaling server running on ws://localhost:${config.server.port}`);

startApi(rooms, config);