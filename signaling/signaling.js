const WebSocket = require('ws');
const { randomBytes } = require('node:crypto');
const config = require('./config');
const { detokenise } = require('./utils/token');
const startApi = require('./api');
const generateRoomId = require('./utils/generateRoomId');
const { v4: uuidv4 } = require('uuid');

const rooms = Object.create(null);
const pendingDisconnects = new Map(); // `${roomId}:${userId}` -> { timer, ws }
const hostGracePeriod = config.hostReconnectGracePeriod ?? config.reconnectGracePeriod ?? 120000;
const clientGracePeriod = config.reconnectGracePeriod ?? 120000;
const wss = new WebSocket.Server({ port: config.server.port });

const send = (ws, message) => {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
};
const clientKey = (roomId, userId) => `${roomId}:${userId}`;

function closeRoom(roomId, reason = 'host-timeout') {
  const room = rooms[roomId];
  if (!room) return;
  clearTimeout(room.hostDisconnectTimer);
  for (const [userId, ws] of room.clients) {
    send(ws, { type: 'room-closed', roomId, reason });
    const pending = pendingDisconnects.get(clientKey(roomId, userId));
    if (pending) clearTimeout(pending.timer);
    pendingDisconnects.delete(clientKey(roomId, userId));
  }
  delete rooms[roomId];
  console.log(`[Room ${roomId}] closed (${reason})`);
}

function handleCreate(ws, data) {
  if (ws.role) return send(ws, { type: 'error', message: 'Socket already joined a room' });
  let roomId;
  do { roomId = generateRoomId(); } while (rooms[roomId]);
  const hostId = uuidv4();
  const hostToken = randomBytes(32).toString('hex');
  rooms[roomId] = {
    host: ws, hostId, hostToken, hostDisconnectTimer: null,
    clients: new Map(), gameId: data?.gameId || null,
    pendingPeerEvents: [],
  };
  Object.assign(ws, { role: 'host', roomId, userId: hostId });
  send(ws, { type: 'room-created', roomId, hostId, userId: hostId, hostToken, gameId: data?.gameId || null });
}

function handleHostResume(ws, data) {
  const room = rooms[data.roomId];
  if (!room || room.host || room.hostId !== data.hostId || room.hostToken !== data.hostToken) {
    return send(ws, { type: 'host-resume-rejected', roomId: data.roomId });
  }
  clearTimeout(room.hostDisconnectTimer);
  room.hostDisconnectTimer = null;
  room.host = ws;
  Object.assign(ws, { role: 'host', roomId: data.roomId, userId: room.hostId });
  const pendingPeers = room.pendingPeerEvents.splice(0);
  send(ws, { type: 'host-resumed', roomId: data.roomId, hostId: room.hostId, pendingPeers });
  for (const client of room.clients.values()) send(client, { type: 'host-resumed', roomId: data.roomId });
}

function handleHostDisconnect(ws, data) {
  const room = rooms[data.roomId];
  if (!room || room.host !== ws || room.hostId !== data.hostId) return;
  closeRoom(data.roomId, 'host-left');
}

function handleClientDisconnect(ws, data) {
  const room = rooms[ws.roomId];
  if (!room || !ws.userId || room.clients.get(ws.userId) !== ws) return;
  room.clients.delete(ws.userId);
  const key = clientKey(ws.roomId, ws.userId);
  const pending = pendingDisconnects.get(key);
  if (pending) clearTimeout(pending.timer);
  pendingDisconnects.delete(key);
  if (room.host) send(room.host, { type: 'peer-left', userId: ws.userId });
}

async function handleJoin(ws, data) {
  try {
    if (!data.token) return send(ws, { type: 'join-rejected', reason: 'missing-token' });
    const joinContext = await detokenise(config.SECRET, data.token);
    const { roomId, username } = joinContext;
    const room = rooms[roomId];
    if (!room) return send(ws, { type: 'join-rejected', reason: 'room-not-found' });

    const userId = data.userId || uuidv4();
    const sameSocketRejoin = ws.role === 'client' && ws.roomId === roomId && ws.userId === userId;
    if (ws.role && !sameSocketRejoin) {
      return send(ws, { type: 'join-rejected', reason: 'socket-already-joined' });
    }
    const key = clientKey(roomId, userId);
    const pending = pendingDisconnects.get(key);
    const isReconnect = Boolean(pending) || room.clients.has(userId);
    if (pending) clearTimeout(pending.timer);
    pendingDisconnects.delete(key);

    Object.assign(ws, { role: 'client', roomId, userId, connectionId: uuidv4() });
    room.clients.set(userId, ws);
    const peerEvent = { type: isReconnect ? 'peer-reconnected' : 'new-peer', userId, username };
    if (room.host) send(room.host, peerEvent);
    else room.pendingPeerEvents.push(peerEvent);
    send(ws, { type: 'join-accepted', roomId, userId, username });
  } catch (error) {
    console.warn('Join rejected:', error.message);
    send(ws, { type: 'join-rejected', reason: 'invalid-token' });
  }
}

function handleSignal(ws, data) {
  const room = rooms[ws.roomId];
  if (!room || !ws.role || !room.host) return;
  if (ws.role === 'host' && room.host !== ws) return;
  if (ws.role === 'client' && room.clients.get(ws.userId) !== ws) return;
  const signal = data.payload;
  const target = signal?.target;
  if (!target) return;
  if (ws.role === 'client' && target === 'host') {
    send(room.host, { type: 'signal', payload: signal, from: ws.userId });
  } else if (ws.role === 'host' && room.clients.has(target)) {
    send(room.clients.get(target), { type: 'signal', payload: signal, from: ws.userId });
  }
}

wss.on('connection', (ws) => {
  ws.role = null;
  ws.roomId = null;
  ws.on('message', (raw) => {
    let data;
    try { data = JSON.parse(raw); }
    catch { return send(ws, { type: 'error', message: 'Invalid JSON' }); }
    switch (data.type) {
      case 'create': return handleCreate(ws, data);
      case 'host-resume': return handleHostResume(ws, data);
      case 'host-disconnected': return handleHostDisconnect(ws, data);
      case 'client-disconnected': return handleClientDisconnect(ws, data);
      case 'join': return handleJoin(ws, data);
      case 'signal': return handleSignal(ws, data);
      default: return send(ws, { type: 'error', message: 'Unknown message type' });
    }
  });

  ws.on('close', () => {
    const { roomId, role, userId } = ws;
    const room = rooms[roomId];
    if (!room) return;
    if (role === 'host' && room.host === ws) {
      room.host = null;
      for (const client of room.clients.values()) send(client, { type: 'host-disconnected', roomId });
      room.hostDisconnectTimer = setTimeout(() => closeRoom(roomId), hostGracePeriod);
      console.log(`[Room ${roomId}] host disconnected; retaining room for ${hostGracePeriod}ms`);
    } else if (role === 'client' && room.clients.get(userId) === ws) {
      const key = clientKey(roomId, userId);
      const oldPending = pendingDisconnects.get(key);
      if (oldPending) clearTimeout(oldPending.timer);
      const pending = { ws, timer: null };
      pending.timer = setTimeout(() => {
        if (rooms[roomId] !== room || room.clients.get(userId) !== ws) return;
        room.clients.delete(userId);
        pendingDisconnects.delete(key);
        if (room.host) send(room.host, { type: 'peer-left', userId });
        else room.pendingPeerEvents.push({ type: 'peer-left', userId });
      }, clientGracePeriod);
      pendingDisconnects.set(key, pending);
      if (room.host) send(room.host, { type: 'peer-disconnected', userId });
      else room.pendingPeerEvents.push({ type: 'peer-disconnected', userId });
    }
  });
});

console.log(`Signaling server running on ws://localhost:${config.server.port}`);
startApi(rooms, config);
