# PeerBox

PeerBox is a JavaScript toolkit for browser and Node.js multiplayer games. It includes an entity-component system and WebRTC peer connections with room signaling, reconnection, and message synchronization.

The project is in early development. The first public packages are the core framework and the optional signaling server. Voice and video are not included in this release.

## Packages

- `@peerbox/core` contains the ECS and networking client APIs.
- `@peerbox/signaling` provides a configurable WebSocket and HTTP signaling server.

## Install

```sh
npm install @peerbox/core
```

To run the included signaling service, install `@peerbox/signaling` as well. You can also use your own signaling service that implements the PeerBox signaling protocol.

## Use

In a browser, create a host or client with the signaling server's WebSocket URL:

```js
import { createClient } from "@peerbox/core/browser";

const inviteToken = "short-lived-token-from-your-game-api";
const client = createClient({
  url: "wss://signal.example.com",
  roomId: "ROOM1",
  username: "Player",
});

await client.connect();
client.server.send("join", { token: inviteToken });
```

`inviteToken` is issued by your game or signaling API. The signaling service must provide the room and join-token flow expected by the client. See the [chat game example](examples/chat-game/README.md) for a complete local setup.

## Development

From the repository root:

```sh
npm install
npm run dev:all
```

To build the core package, run `npm run build --prefix packages/peerbox` from the repository root.

## Publishing

From the repository root, rehearse the release with `npm run publish:public -- --dry-run`. Run `npm run publish:public` to publish `@peerbox/core` and `@peerbox/signaling` in order. Publishing requires npm credentials and makes both packages public.

## License

PeerBox is distributed under the MIT License. Each published package includes its own copy of the license.
