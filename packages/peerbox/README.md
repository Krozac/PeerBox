# @peerbox/core

PeerBox is a JavaScript toolkit for browser and Node.js multiplayer games. The core package provides an entity-component system, WebRTC host and client APIs, and message synchronization.

## Install

```sh
npm install @peerbox/core
```

## Browser client

```js
import { createClient } from "@peerbox/core/browser";

const inviteToken = "short-lived-token-from-your-game-api";
const client = createClient({
  url: "wss://signal.example.com",
  roomId: "ROOM1",
  username: "Player",
});

client.on("peer-connected", () => {
  console.log("Connected to the host");
});

await client.connect();
client.server.send("join", { token: inviteToken });
```

`inviteToken` is issued by your game or signaling API. The host API is available from the same `/browser` entry point. The `/node` entry point provides a Node.js host and uses `ws`; install `wrtc` separately to use it.

PeerBox does not require its own signaling server. The server must support PeerBox's room and WebRTC negotiation protocol. The optional [`@peerbox/signaling`](https://www.npmjs.com/package/@peerbox/signaling) package provides a configurable implementation.

See the [chat game example](../../examples/chat-game/README.md) for a complete application.

## License

MIT.
