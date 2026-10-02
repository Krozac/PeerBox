# PeerBox browser-hosted chat example

This example runs the PeerBox host in a browser tab. The signaling service keeps room membership and relays WebRTC setup messages; game messages travel over peer data channels.

## Run locally

Start the signaling service and Vite app in separate terminals from the repository root:

```sh
npm run dev:signal
npm run dev:example
```

Open `http://localhost:5173/host.html`, enter a display name, and create a room. The host page opens the regular player game inside the same tab, while the parent page keeps the authoritative world running and provides room controls. Share the invite link or room code. Players open the same site, enter a name and code, then join. Keep the host page open for the room's lifetime.

## Pages

- `/` — player join form
- `/host.html` — browser host, player view, and compact room controls
- `/game.html?token=…` — connected player game

The Electron host under `host/` is a separate example and is not required for the browser flow.

## Network configuration

For local development, the app defaults to signaling at `ws://<current-host>:5501` and the room API at `http://<current-host>:5502`. Set `VITE_SIGNALING_URL` and `VITE_API_URL` when deploying behind different hostnames or ports. A page served over HTTPS needs secure WebSocket and API endpoints (`wss://` and `https://`).

The example uses a public STUN server and intentionally has no voice plugin. Production deployments may need TURN configuration for users whose networks cannot establish a direct peer connection.
