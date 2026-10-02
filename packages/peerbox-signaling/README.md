# @peerbox/signaling

Composable signaling server pieces for PeerBox. The package is independent of the PeerBox client and can be used as a complete WebSocket/HTTP service or as a source of the shared protocol constants.

```js
const { createSignalingServer } = require("@peerbox/signaling");

const server = createSignalingServer({
  port: 5501,
  apiPort: 5502,
  games: { arena: "https://games.example/arena/" },
  issueJoinToken: ({ roomId, username, account }) => accountService.createRoomInvite({ roomId, username, account }),
  verifyJoinToken: (token) => accountService.verifyRoomInvite(token),
  authenticateJoin: ({ claims }) => accountService.canJoin(claims.account, claims.roomId),
});
```

`issueJoinToken` and `verifyJoinToken` are required application hooks. This keeps token format, account identity, and authorization under the deploying game's control. `authenticateJoin` is an optional additional check at WebSocket join time. The built-in HTTP API serves `/health`, `/stats`, `/games`, `/rooms/:roomId`, and `/token`; `/token` calls the configured issuer and returns the matching game's URL.

The returned object exposes `rooms`, `wss`, and `app` for integration and customization, plus `close()` for orderly shutdown. `./protocol` exports the technical client/server message type constants independently. The signaling server routes room membership and WebRTC negotiation messages; it does not validate gameplay or make game state authoritative.

The existing repository-level `signaling/` application remains the current example deployment. It has not yet been migrated to this package.
