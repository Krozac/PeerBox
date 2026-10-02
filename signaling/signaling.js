const { createSignalingServer } = require('../packages/peerbox-signaling');
const config = require('./config');
const { tokenise, detokenise } = require('./utils/token');

const server = createSignalingServer({
  port: config.server.port,
  apiPort: config.api.port,
  maxClients: config.rooms.maxClients,
  games: config.games,
  hostReconnectGracePeriod: config.hostReconnectGracePeriod ?? config.reconnectGracePeriod,
  reconnectGracePeriod: config.reconnectGracePeriod,
  issueJoinToken: ({ roomId, username }) => tokenise(config.SECRET, {
    roomId,
    username,
    exp: Math.floor(Date.now() / 1000) + 60 * 5,
  }),
  verifyJoinToken: async (token) => {
    const claims = await detokenise(config.SECRET, token);
    if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Join token expired');
    }
    return claims;
  },
});

console.log(`Signaling server running on ws://localhost:${config.server.port}`);
console.log(`Room API running on http://localhost:${config.api.port}`);

module.exports = server;
