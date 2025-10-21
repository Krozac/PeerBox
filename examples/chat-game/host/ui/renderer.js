const ws = new WebSocket(window.env?.SIGNALING_URL || 'ws://localhost:5501');

const statusEl = document.getElementById('status');
const roomIdEl = document.getElementById('room-id');
const peerCountEl = document.getElementById('peer-count');



let roomID;
let peers = 0;

import { handleNewPeer, handleSignalFromClient, removePeer} from './peerHandler.js'

let localUsername = '';

function sendSignal(clientId, signalData) {
    ws.send(JSON.stringify({
        type: 'signal',
        payload: {
            target: clientId,
            ...signalData
    }
    }));
}



ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'create' }));
  statusEl.textContent = 'Creating room...';
};

ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);

    if (data.type === 'room-created') {
        roomID = data.roomId;
        roomIdEl.textContent = roomID;
        statusEl.textContent = 'Room created. Waiting for players...';
    }

    if (data.type === 'new-peer') {
        peers += 1;
        peerCountEl.textContent = peers;
        handleNewPeer(data.clientId,sendSignal)
    }

    if (data.type === 'peer-left') {
        peers = Math.max(0, peers - 1);
        peerCountEl.textContent = peers;
    }
         console.log(data.type);
    if (data.type === 'signal') {
        console.log(data);
        handleSignalFromClient(data.from, data.payload);
    }
};

window.addEventListener('beforeunload', () => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'host-disconnected',
      roomId: roomID,
    }));
    ws.close();
  }
});
