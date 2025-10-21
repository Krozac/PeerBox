// signalingProtocol.cjs
const SIGNAL_TYPES = {
  OFFER: "offer",
  ANSWER: "answer",
  ICE_CANDIDATE: "ice-candidate",
  HOST_DISCONNECTED: "host-disconnected",
};

const SERVER_MSG_TYPES = {
  CREATE: "create",
  JOIN: "join",
  SIGNAL: "signal",
  CLIENT_DISCONNECTED: "client-disconnected",

  ROOM_CREATED: "room-created",
  JOIN_ACCEPTED: "join-accepted",
  JOIN_REJECTED: "join-rejected",
  NEW_PEER: "new-peer",
  PEER_LEFT: "peer-left",
  ERROR: "error",
};

function createSignal(type, payload = {}) {
  return { type, ...payload };
}

function createServerMessage(type, payload = {}) {
  return { type, ...payload };
}

function parseJSON(raw) {
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn("Invalid signal JSON:", raw);
    return null;
  }
}

module.exports = {
  SIGNAL_TYPES,
  SERVER_MSG_TYPES,
  createSignal,
  createServerMessage,
  parseJSON,
};
