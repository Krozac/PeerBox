import * as Peerbox from "peerbox";
import { createClient } from "peerbox/browser";

import { ChatScene } from './scenes/chatScene.js';
import { env } from "./clientEnv.js";

import VoicePlugin from "peerbox-voice";

let params = new URLSearchParams(document.location.search)
const token = params.get("token")

let username;
let roomId;


import signal1 from './assets/models/signal/signal1.svg';
import signal2 from './assets/models/signal/signal2.svg';
import signal3 from './assets/models/signal/signal3.svg';


import { SweepRightTransition, SweepLeftTransition } from './transitions/sweep.js';

const signals = [signal1, signal2, signal3];

async function bootstrap() {

  Peerbox.Utils.LoadingOverlay.show("Connecting to host...",document.getElementById("game-root"));

  const token = params.get("token")
  if (!token) window.location.href = `http://127.0.0.1:8080/`;

  // 1. networking
  const client = createClient({
    url: "ws://localhost:5501",
    username: localStorage.getItem("username"),
    rtcConfiguration: {
        iceServers: [
            // STUN (optional on LAN, but harmless)
            { urls: "stun:stun.l.google.com:19302" },

            // YOUR LOCAL TURN SERVER
            {
            urls: [
                "turn:192.168.1.15:3478?transport=udp",
                "turn:192.168.1.15:3478?transport=tcp"
            ],
            username: "webrtc",
            credential: "webrtc123"
            }
        ]
    },
    plugins: [VoicePlugin()],
  });
  console.log("plugins : ",client.plugins.getPlugin("voice"))

  const audioMap = new Map();

  client.peer.on("track", ({ stream, clientId }) => {
    if (audioMap.has(clientId)) return;

    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.playsInline = true;
    audio.controls = true;

    audio.srcObject = stream;
    console.log("Tracks:", stream.getTracks());

    console.log("Audio tracks:", stream.getAudioTracks());
    document.body.appendChild(audio);
    audioMap.set(clientId, audio);

    audio.onloadedmetadata = async () => {
      try {
        await audio.play();
        console.log("Audio playing for", clientId);
      } catch (e) {
        console.error("Audio play failed:", e);
      }
    };
  });

  await client.connect();

  client.server.send("join", { token,userId : localStorage.getItem('clientId') || null});

  client.server.on("join-accepted", async (msg) => {
    console.log(`✅ Joined ${msg.roomId} as ${msg.username}`);
    console.log(msg)
    
    username = msg.username;
    roomId = msg.roomId;
    console.log(msg)
    client.id = msg.userId;
    await client.plugins.getPlugin("voice").enableMicrophone();


    if (msg.userId) {
      localStorage.setItem("clientId", msg.userId);
    }

  });
  client.on("connected", async () => {
    console.log("✅ Connected to host, starting ECS...");

    // 2. ECS world
    const world = new Peerbox.World();
    world.registerSystem(Peerbox.Systems.HtmlRenderSystem,{type:"render"});
    world.registerSystem(Peerbox.Systems.PingSystem(client, { interval: 2 }));
    world.registerSystem(Peerbox.Systems.PhysicsSystem);

    world.registerSystem(Peerbox.Systems.ParticleSystem)
    world.registerSystem(Peerbox.Systems.ParticleMovementSystem)
    world.registerSystem(Peerbox.Systems.ToastSystem);
    
    const sync = new Peerbox.SyncSystem({world, network:client, isHost:false});

    const transitions = new Peerbox.TransitionManager();
    transitions.register("bubbles-sweep-right",SweepRightTransition);
    transitions.register("bubbles-sweep-left",SweepLeftTransition);

    const scenes = new Peerbox.SceneManager("#scene-container",{loading:true, loadingDelay:120, transitionManager:transitions});
    //inject title helper 
    scenes.setTitle = (title) =>{
      let titledom = document.getElementById("sceneTitle");
      if (!titledom) return;
      titledom.innerHTML = title;
    }

    await scenes.load(ChatScene,{world , sync ,client});

    sync.onAction("users-state",(payload) => { reconcileUsers(payload.payload,world) }, {key:"client-users-state"});

    let fpsEl = document.getElementById("status-fps");
    let smoothedFps = 60;
    let fpsAccumulator = 0;
    
    Peerbox.GameLoop.start({
      onUpdate : (dt) => world.update(dt),
      onRender : (dt) => {
        world.render(dt)
        
        // dt is in seconds (GameLoop converts ms->s)
        const instFps = dt > 0 ? 1 / dt : 0;
        // exponential moving average for stability
        smoothedFps = smoothedFps * 0.9 + instFps * 0.1;

        fpsAccumulator += dt;
        // update UI every 200ms
        if (fpsAccumulator >= 0.2) {
          fpsEl.innerText = `FPS: ${Math.round(smoothedFps)}`;
          fpsAccumulator = 0;
        }
      
      }
    });

    let pingentity = world.createEntity()

    world.addComponent(pingentity,Peerbox.Components.HtmlRenderComponent, {
      parentSelector: "#status-ping",
      tagName: "div",
      classes: null,
      html: `<strong>0ms</strong>`,
    })

    world.on("ping-update",({ rtt, id})=>{
      console.log(rtt)
      let pingcomp = world.getComponent(pingentity,Peerbox.Components.HtmlRenderComponent)
        // Update the text
        let html = `<p style="display:inline">${rtt}ms</p>`;

        // Determine signal level
        let level;
        if (rtt < 50) level = 2;       // best
        else if (rtt < 150) level = 1;  // medium
        else level = 0;                 // worst

        // Append the SVG image
        html += `<div style="display:inline;vertical-align:top; " class="ping-signal"><img src="${signals[level]}" alt="signal"/></div>`;

        // Update component html
        pingcomp.html = html;

    })

    document.getElementById("status-entity").innerHTML = "E:"+world.entities.size;

    world.on("entityCreated", () =>{
      document.getElementById("status-entity").innerHTML = "E:"+world.entities.size;
    })

     world.on("entityRemoved", () =>{
      document.getElementById("status-entity").innerHTML = "E:"+world.entities.size;
    })


    document.getElementById("room-id").innerHTML = roomId;
    document.getElementById("copyRoomIdBtn").addEventListener("click", () => {
      navigator.clipboard.writeText(roomId).then(() => {
        window.dispatchEvent(new CustomEvent("toast", {
          detail: {
            message: "Room ID copied to clipboard!",
            duration: 2, // seconds
            type: "success"
          }
          
        }));
      }).catch(err => {
        console.error("Failed to copy Room ID: ", err);
      });
    });

    //intro got back

    client.on("join-ack", ({ userEntityId, userList, username }) => {
      console.log(`Joined as ${username}, entity = ${userEntityId}`);


      document.getElementById("status-client").innerHTML=userEntityId;
      console.log("Existing users in the room:", userList);
     

      console.log(world.getEntities());

      world.clientEntityId = userEntityId;   // ECS id
      client.entityId = userEntityId;        // same ECS id

      client.username = username;
    });

    // ✅ Now it’s safe to announce yourself
    client.send({
        type: "intro",
        payload: { username }
      });

    Peerbox.Utils.LoadingOverlay.hide();
  });

}

let currentScale = 1;
let currentOffsetX = 0;
let currentOffsetY = 0;



function resizeGameRoot() {
  const root = document.getElementById("game-root");
  if (!root) return;

  const targetWidth = 1920;
  const targetHeight = 1080;

  const scaleX = window.innerWidth / targetWidth;
  const scaleY = window.innerHeight / targetHeight;
  const scale = Math.min(scaleX, scaleY);

  const offsetX = (window.innerWidth - targetWidth * scale) / 2;
  const offsetY = (window.innerHeight - targetHeight * scale) / 2;

  root.style.position = "absolute";
  root.style.transformOrigin = "top left";
  root.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  
  // store for coordinate conversion
  currentScale = scale;
  currentOffsetX = offsetX;
  currentOffsetY = offsetY;
}

function reconcileUsers(users, world) {
  let existingUsers = new Set(world.getEntitiesWithComponent(Peerbox.Components.userComponent).map(e => world.getComponent(e, Peerbox.Components.userComponent).id));

  users.forEach(user => {
    if (!existingUsers.has(user.id)) {
      // New user, create entity
      const entity = world.createEntity();
      world.addComponent(entity, Peerbox.Components.userComponent, {
        id: user.id,
        name: user.name,
        color: user.color,
      });
    } else {
      existingUsers.delete(user.id); // still exists, remove from set
    }
  });

  // Any remaining in existingUsers set are disconnected, remove them
  existingUsers.forEach(id => {
    const entity = world.getEntitiesWithComponent(Peerbox.Components.userComponent).find(e => world.getComponent(e, Peerbox.Components.userComponent).id === id);
    if (entity) {
      world.entities.delete(entity);
      world.components.delete(entity);
    }
  });

  console.log("Reconciled users. Current user entities:", world.getEntitiesWithComponent(Peerbox.Components.userComponent).map(e => world.getComponent(e, Peerbox.Components.userComponent)));

}



window.addEventListener("resize", resizeGameRoot);
resizeGameRoot();


bootstrap();
