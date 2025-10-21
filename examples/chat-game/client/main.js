import * as Peerbox from '../../../framework/dist/index.js';
import Client from '../../../framework/dist/client.js';

import { ChatScene } from './scenes/chatScene.js';
import { env } from "./clientEnv.js";
import { SyncSystem } from '../../../framework/dist/index.js';
import { Utils } from '../../../framework/dist/index.js';

let params = new URLSearchParams(document.location.search)
const token = params.get("token")

let username;
let roomId;


import signal1 from './assets/models/signal/signal1.svg';
import signal2 from './assets/models/signal/signal2.svg';
import signal3 from './assets/models/signal/signal3.svg';
import { HtmlRenderComponent } from '../../../framework/src/ecs/components/HtmlRenderComponent.js';
import { GravityComponent } from '../../../framework/src/ecs/components/GravityComponent.js';

const signals = [signal1, signal2, signal3];

async function bootstrap() {

  Utils.LoadingOverlay.show("Connecting to host...");

  const token = params.get("token")
  if (!token) window.location.href = `http://127.0.0.1:8080/`;

  // 1. networking
  const client = new Client({ signalingUrl: "ws://localhost:5501" });
  await client.connect();
  client.signaling.send("join", { token,clientId : localStorage.getItem('clientId') || null});

  client.signaling.on("join-accepted", async (msg) => {
    console.log(`✅ Joined ${msg.roomId} as ${msg.username}`);

    username = msg.username;
    roomId = msg.roomId;
    console.log(msg)

    if (msg.clientId) {
      localStorage.setItem("clientId", msg.clientId);
    }

  });
  client.peerConnection.on("connected", async () => {
    console.log("✅ Connected to host, starting ECS...");

    // 2. ECS world
    const world = new Peerbox.World();
    world.registerSystem(Peerbox.Systems.HtmlRenderSystem,{type:"render"});
    world.registerSystem(Peerbox.Systems.PingSystem(client, { interval: 2 }));
    world.registerSystem(Peerbox.Systems.PhysicsSystem);

    world.registerSystem(Peerbox.Systems.ParticleSystem)
    world.registerSystem(Peerbox.Systems.ParticleMovementSystem)
    
    const sync = new SyncSystem({world, network:client, isHost:false});

    const scenes = new Peerbox.SceneManager("#scene-container",{loading:true, loadingDelay:120});
    await scenes.load(ChatScene,{world , sync ,client});

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
/*
    let emitterEntity = world.createEntity();

    world.addComponent(emitterEntity,Peerbox.Components.PositionComponent,{x:900,y:500})


    world.addComponent(emitterEntity, Peerbox.Components.ParticleEmitterComponent, {
      rate: 5,
      maxParticles: 100,  
      active:true,
      timeSinceLast:0,
      spawnParticle: (world, emitter) => {
        const emitterPos = world.getComponent(emitterEntity, Peerbox.Components.PositionComponent);
        const id = world.createEntity();

        world.addComponent(id,Peerbox.Components.ParticleTag);
        

        //this is a kinematic and will overwrite any physics movement (gravity, velocity, etc...)
        world.addComponent(id,Peerbox.Components.MovementPatternComponent,{
          type: "spiral",
          params: {
            angularSpeed: 1,      // radians per second
            radiusGrowth: 25,     // units per second outward
            originX:emitterPos.x,
            originY:emitterPos.y,
          }
        })
        world.addComponent(id, Peerbox.Components.PositionComponent, { x: emitterPos.x, y: emitterPos.y });
        world.addComponent(id, Peerbox.Components.LifetimeComponent, { value: 15, age: 0 });
        world.addComponent(id,Peerbox.Components.HtmlRenderComponent,
        {
          parentSelector: "#game-root",
          tagName: "div",
          classes: [
            "particle-dot"
          ],
          html: ``,
        })
      
      },
    });

    let emitterEntity2 = world.createEntity();
    world.addComponent(emitterEntity2,Peerbox.Components.PositionComponent,{x:1200,y:500})
    world.addComponent(emitterEntity2, Peerbox.Components.ParticleEmitterComponent, {
      rate: 5,
      maxParticles: 100,  
      active:true,
      timeSinceLast:0,
      spawnParticle: (world, emitter) => {
        const emitterPos = world.getComponent(emitterEntity2, Peerbox.Components.PositionComponent);
        const id = world.createEntity();

        world.addComponent(id,Peerbox.Components.ParticleTag);
        

        //this is a kinematic and will overwrite any physics movement (gravity, velocity, etc...)
        world.addComponent(id,Peerbox.Components.MovementPatternComponent,{
          type: "wave",
          params: {
            speedX: 100,      // radians per second
            frequency: 5,     // units per second outward
            amplitude:50,
            originX:emitterPos.x,
            originY:emitterPos.y,
          }
        })
        world.addComponent(id, Peerbox.Components.PositionComponent, { x: emitterPos.x, y: emitterPos.y });
        world.addComponent(id, Peerbox.Components.LifetimeComponent, { value: 15, age: 0 });
        world.addComponent(id,Peerbox.Components.HtmlRenderComponent,
        {
          parentSelector: "#game-root",
          tagName: "div",
          classes: [
            "particle-dot-1"
          ],
          html: ``,
        })
      
      },
    });



let burstEmitterEntity = world.createEntity();

// Position for the burst origin
world.addComponent(burstEmitterEntity, Peerbox.Components.PositionComponent, { x: 500, y: 1000 });

world.addComponent(burstEmitterEntity, Peerbox.Components.ParticleEmitterComponent, {
    mode: "burst",            // 👈 tells ParticleSystem to use burst behavior
    active: true,
    timeSinceLast: 0,
    burstDelay: 0.8,          // one burst every 0.8 seconds
    burstCount: 5,           // emit 40 particles per burst
    maxParticles: 300,        // total cap (used by ParticleSystem)
    
    spawnParticle: (world, emitter) => {
      const emitterPos = world.getComponent(emitter, Peerbox.Components.PositionComponent);
      const id = world.createEntity();

      world.addComponent(id, Peerbox.Components.ParticleTag);
      world.addComponent(id, Peerbox.Components.PositionComponent, {
        x: emitterPos.x,
        y: emitterPos.y,
      });

      // Give particles a random velocity or pattern so the burst looks explosive
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 50;
      world.addComponent(id, Peerbox.Components.VelocityComponent, {
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
      });

      world.addComponent(id, Peerbox.Components.LifetimeComponent, { value: 5, age: 0 });
      world.addComponent(id,Peerbox.Components.GravityComponent,{
        x:0,
        y:98.1
      })

      // Simple HTML render
      world.addComponent(id, Peerbox.Components.HtmlRenderComponent, {
        parentSelector: "#game-root",
        tagName: "div",
        classes: ["particle-dot-2"],
        html: "",
      });
    },
  });
    */

  

    document.getElementById("room-id").innerHTML = roomId;

    //intro got back

    client.peerConnection.on("join-ack", ({ userEntityId, username }) => {
      console.log(`Joined as ${username}, entity = ${userEntityId}`);


      document.getElementById("status-client").innerHTML=userEntityId;
      world.clientEntityId = userEntityId;
      client.userEntityId = userEntityId;
      client.username = username;
    });

    // ✅ Now it’s safe to announce yourself
    client.peerConnection.send({ type: "intro", username });

    Utils.LoadingOverlay.hide();
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

  root.style.transform = `scale(${scale})`;
  root.style.position = "absolute";
  root.style.left = `${offsetX}px`;
  root.style.top = `${offsetY}px`;

  // store for coordinate conversion
  currentScale = scale;
  currentOffsetX = offsetX;
  currentOffsetY = offsetY;
}

window.addEventListener("resize", resizeGameRoot);
resizeGameRoot();


bootstrap();
