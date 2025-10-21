import { Components, Scene } from "../../../../framework/dist/index.js";
import { SettingsScene } from "./settingsScene.js";

export const ChatScene = new Scene({
  name: "chat",
  htmlPath: "scenes/chatScene.html",

  onLoad: ({world, client, sync }, sceneManager) => {
    console.log("ChatScene loaded");

    // --- Helper to render chat messages in UI ---
    const renderChatMessage = (msg) => {
      const entity = world.createEntity();
      world.addComponent(entity, Components.HtmlRenderComponent, {
        parentSelector: "#chatBox",
        tagName: "div",
        classes: [
          "pb-bubbles-chat-message",
          msg.username === "You"
            ? "pb-bubbles-chat-message--self"
            : "pb-bubbles-chat-message--other",
        ],
        html: `<strong>${msg.username}:</strong> ${msg.text}`,
      });
      return entity;
    };

    const predictedMessages = new Map();

    // --- Register sync handler for chat messages ---
    sync.onAction("chat-message", ({ payload, clientId ,seq, predicted, confirmed }) => {
      // You can add extra logic for predicted/confirmed here if needed

      const { username, text } = payload;

      if (predicted) {
        const entity = renderChatMessage({
          username: username || (clientId === client.id ? "You" : `User ${clientId}`),
          text,
        });

        predictedMessages.set(seq, entity);
        return;
      }

      if (confirmed && predictedMessages.has(seq)) {
        const entity = predictedMessages.get(seq);

        // ✅ Update existing message instead of creating a new one
        const el = world.getComponent(entity, Components.HtmlRenderComponent);
        if (el) {
          el.html = `<strong>${username}:</strong> ${text}`;
        }

        // Optionally mark as "synced"
        el.classes = [...(el.classes || []), "synced"];

        predictedMessages.delete(seq);
        return;
      }

        // If it’s a message from another client or new authoritative state
        renderChatMessage({
          username: username || (clientId === client.id ? "You" : `User ${clientId}`),
          text,
        });
    });

    
    sync.onError("chat-message", ({ clientId, reason,action,seq  })=> {


      console.log(predictedMessages)
      console.error(`Action "${action}" failed: ${reason}`);  
      if (seq != null && predictedMessages.has(seq)) {
        const entityId = predictedMessages.get(seq);
        const renderComp = world.getComponent(entityId, Components.HtmlRenderComponent);
        if (renderComp) {
            renderComp.classes.push("pb-bubbles-chat-message--failed"); // add failure class
            renderComp.html = renderComp.html + " (" +reason+")";
        }
        predictedMessages.delete(seq);
      }
    });

    // --- Register local UI events ---
    const settingsBtn = document.getElementById("settings");
    const chatForm = document.getElementById("chatForm");
    const chatInput = document.getElementById("chatInput");

    const onSettingsClick = async () => {
      await sceneManager.load(SettingsScene, {world, client});
    };

    const onFormSubmit = (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;

      // Send chat message via sync system
      sync.send(
        "chat-message",
        {
          username: client.user?.name || "You",
          text,
        },
        { predict: true } // instantly show locally while waiting for host confirmation
      );

      chatInput.value = "";
    };

    settingsBtn?.addEventListener("click", onSettingsClick);
    chatForm?.addEventListener("submit", onFormSubmit);

    // ✅ Return cleanup function for SceneManager
    return () => {
      settingsBtn?.removeEventListener("click", onSettingsClick);
      chatForm?.removeEventListener("submit", onFormSubmit);
    };
  },
});
