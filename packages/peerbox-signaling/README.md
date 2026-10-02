# @peerbox/signaling

`@peerbox/signaling` is an optional WebSocket and HTTP signaling server for PeerBox. It manages rooms and relays WebRTC negotiation messages. Game messages travel over peer connections; this service does not make game state authoritative.

## Install

```sh
npm install @peerbox/signaling
```

## Start a server

The application supplies its own token format and account checks:

```js
const { createSignalingServer } = require("@peerbox/signaling");
const { tokenise, detokenise } = require("./joinTokens.cjs");

createSignalingServer({
  port: 5501,
  apiPort: 5502,
  games: { arena: "https://games.example/arena/" },
  issueJoinToken: ({ roomId, username }) => tokenise(roomId, username),
  verifyJoinToken: (token) => detokenise(token),
});
```

`issueJoinToken` and `verifyJoinToken` are required. They can connect the server to an existing account system. The optional `authenticateJoin` callback can perform an additional authorization check when a token is used to join.

The HTTP API provides `/health`, `/stats`, `/games`, `/rooms/:roomId`, and `/token`. The token endpoint calls `issueJoinToken` and returns the URL configured for the room's game. Options also include `maxClients`, `hostReconnectGracePeriod`, and `reconnectGracePeriod`.

The returned server object exposes `rooms`, `wss`, and `app`, and has a `close()` method. Import protocol constants separately with `@peerbox/signaling/protocol` if you are implementing your own signaling service.

## License

MIT.
