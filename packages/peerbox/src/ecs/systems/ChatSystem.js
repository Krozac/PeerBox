// ChatSystem.js

import { ChatComponent, ChatMessageComponent, HtmlRenderComponent, SoundComponent } from '../components/index.js'; 

export function ChatSystem(ecs, soundSystem ,config= {}) {

  const newMessageSound = config.newMessageSound;
  const newMessageVolume = config.newMessageVolume ?? 0.1;
  const chatParentSelectorId = config.chatParentSelectorId ?? '#chatBox';
  
  document.addEventListener('datachannel-message', async (e) => {

    const { sender, message, timestamp = Date.now(), chatId = 'default' } = e.detail;

    // Create a chat message entity in ECS
    const entity = ecs.createEntity();
    ecs.addComponent(entity, ChatMessageComponent, { username: sender, message, timestamp, chatId });

    // Add HtmlRenderComponent for UI
    ecs.addComponent(entity, HtmlRenderComponent, {
      tagName: 'div',
      classes: [
        'pb-chat-message',
        sender === 'You' ? 'pb-chat-message--self' : 'pb-chat-message--other'
      ],
      html: `<strong>${sender}:</strong> ${message}`,
      parentSelector: chatParentSelectorId,
    });

    // Add SoundComponent if message is from someone else
    if (sender !== 'You' && soundSystem && newMessageSound) {
      ecs.addComponent(entity, SoundComponent, { url: newMessageSound, volume: newMessageVolume, loop: false });

      const soundComp = ecs.getComponent(entity, SoundComponent);

      await soundSystem.loadSound(entity, soundComp);
      soundSystem.playSound(entity);
    }

  });
}
