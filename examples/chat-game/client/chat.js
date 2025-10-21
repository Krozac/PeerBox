import { ClientPeerConnection } from 'peerbox';

let sendChatMessage = ClientPeerConnection.sendChatMessage;

const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
let chatBox = document.getElementById('chatBox');

const role = new URLSearchParams(window.location.search).get('role') || 'client';

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const message = chatInput.value.trim();
  if (!message) return;

  if (role === 'host') {
    window.env.sendHostChat(message);
  } else if (role === 'client') {
    sendChatMessage(message);
  }

  document.dispatchEvent(new CustomEvent('datachannel-message', {
    detail: {
      sender: 'You',
      message,
      timestamp: Date.now(),
    }
  }));

  if (!chatBox) {
    chatBox = document.querySelector('.pb-chat-messages');
  }

  chatBox.scrollTop = chatBox.scrollHeight;
  chatInput.value = '';
});

// Append chat message to chatBox UI
function appendChatMessage(sender, message) {
  if (!chatBox) return;

  const msgElem = document.createElement('div');
  msgElem.classList.add(
    'pb-chat-message',
    sender === 'You' ? 'pb-chat-message--self' : 'pb-chat-message--other'
  );
  msgElem.innerHTML = `<strong>${sender}:</strong> ${message}`;

  chatBox.appendChild(msgElem);
  chatBox.scrollTop = chatBox.scrollHeight;
}

export { appendChatMessage };
