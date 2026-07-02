import { Components, Scene } from "peerbox";
import { SettingsScene } from "./settingsScene.js";
import { models } from "../assets/index.js";

export const ChatScene = new Scene({
  name: "chat",
  htmlPath: "scenes/chatScene.html",

  onLoad: ({world, client, sync }, sceneManager) => {
    console.log("ChatScene loaded");
    sceneManager.setTitle("PeerBox");

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

    const renderUser = (user, x , y) => {
      const entity = world.createEntity();
      const model = models[user.color] || models["red"]; // fallback to red if color not found

      world.addComponent(entity, Components.HtmlRenderComponent, {
        parentSelector: "#userList",
        tagName: "div",
        classes: ["pb-bubbles-user"],
        html: `<img src="${model}" alt="${user.name}" class="pb-bubbles-user-item"><span class="pb-bubbles-user-name">${user.name}</span>`,
        style: {
          position: "absolute",
          left: `${x}px`,
          top: `${y}px`,
        },
      });
      return entity;
    }

    const predictedMessages = new Map();

    // --- Register sync handler for chat messages ---
    sync.onAction("chat-message", ({ payload,clientId ,clientEntityId ,seq, predicted, confirmed }) => {
      // You can add extra logic for predicted/confirmed here if needed

      const { username, text } = payload;

      if (predicted) {
        const entity = renderChatMessage({
          username: clientId === client.id ? "You" : `${username}`,
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
          el.html = `<strong>${clientId === client.id ? "You" : `${username}`}:</strong> ${text}`;
        }

        // Optionally mark as "synced"
        el.classes = [...(el.classes || []), "synced"];

        predictedMessages.delete(seq);
        return;
      }

        // If it’s a message from another client or new authoritative state
        renderChatMessage({
          username: clientId === client.id ? "You" : `${username}`,
          text,
        });
    }, { key: "ChatScene.chat-message" });

    
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
    }, { key: "ChatScene.chat-message" });

    sync.onAction("users-state", ({ payload }) => {
      const users = payload;
      //cleanup existing users
      const existingUsers = world.getEntitiesWithComponent(Components.HtmlRenderComponent).filter((entity) => {
        const comp = world.getComponent(entity, Components.HtmlRenderComponent);
        return comp?.parentSelector === "#userList";
      });
      world.removeEntities(existingUsers);

      let n = 0;
      for (const user of users) {
        const { x, y } = layoutUserInCircle(n++,users.length, { cx: 400, cy: 150, radius: 100 });
        renderUser(user, x, y);
      }
    }, { key: "ChatScene.users-state" });

    client.on("chat-history", ({ payload }) => {
      const { messages } = payload;

      if (!Array.isArray(messages)) return;
      console.log("client id : ",client.id);

      for (const msg of messages) {
        renderChatMessage({
          username:
            msg.from === client.id ? "You" : `${msg.username}`,
          text: msg.text,
        });
      }
    });

    // --- Register local UI events ---
    const settingsBtn = document.getElementById("settings");
    const chatForm = document.getElementById("chatForm");
    const chatInput = document.getElementById("chatInput");

    const onSettingsClick = async () => {
      await sceneManager.load(SettingsScene, {world, client}, "bubbles-sweep-right");
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

function layoutUserInCircle(i, n, { cx, cy, radius }) {
  if (n === 0) return null;

  if (n === 1) {
    return { x: cx, y: cy };
  }

  const step = (Math.PI * 2) / n;
  const angle = i * step - Math.PI / 2;

  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  };
}