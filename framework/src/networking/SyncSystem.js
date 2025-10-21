export default function SyncSystem({ world, network, isHost = false }) {
  const actionHandlers = new Map();     // For incoming actions
  const registeredActions = new Map();  // For outgoing builders

  const errorHandlers = new Map();

  // --- Client-side prediction ---
  let seq = 0;
  const pendingPredictions = new Map(); // seq → {action, payload}

  // === Action registration ===
  function onAction(type, handler) {
    actionHandlers.set(type, handler);
  }

  function onError(type, handler){
    errorHandlers.set(type,handler)
  };

  function registerAction(type, builder) {
    registeredActions.set(type, builder);
  }

  // === Sending actions ===
  function send(actionType, payload, options = {}) {
    const builder = registeredActions.get(actionType);
    const msg = builder ? builder(payload) : { action: actionType, payload };
    msg.seq = ++seq;

    msg.clientEntityId = world.clientEntityId || network.id; 

    // Locally apply prediction before confirmation (client only)
    if (!isHost && options.predict) {
      const handler = actionHandlers.get(actionType);
      if (handler) {
        handler({ world, payload, clientId: network.id, predicted: true, seq:msg.seq});
      }
      const key = `${msg.clientEntityId}:${msg.seq}`;
      pendingPredictions.set(key, msg);
    }

    network.send({
      type: "sync",
      action: msg.action,
      payload: msg.payload,
      seq: msg.seq,
      clientEntityId: msg.clientEntityId, // ✅ send it out
    });
  }

  // === Broadcast (host only) ===
  function broadcast(actionType, payload, opts = {},seq,clientEntityId) {
    if (!isHost) {
      console.warn(`[SyncSystem] broadcast() is host-only`);
      return;
    }

    if (typeof network.broadcast !== "function") {
      console.warn(`[SyncSystem] network.broadcast not implemented`);
      return;
    }

    network.broadcast({
      type: "sync",
      action: actionType,
      payload,
      seq,
      clientEntityId // ✅ or pass the original clientEntityId if you have it
    }, opts);
  }

  function sendTo(clientId, actionType, payload) {
    console.log(clientId);
    network.send(clientId,{
      type: "sync",
      action: actionType,
      payload,
    });
  }

  // === Receiving actions ===
  network.on("sync", ({ clientId,clientEntityId, action, payload, seq }) => {
    const handler = actionHandlers.get(action);
    if (!handler) return;

    if (isHost) {
      // Host validates the incoming request
      const result = handler({ world, payload, clientId });

      if (!result || result.valid === false) {
        // Send failure back to the client
        network.send(clientId, {
          type: "sync-error",
          error: {
            action,      // the original action type that failed
            reason: result?.reason || "Invalid action",
            seq,         // optional: sequence number
            payload,     // optional: original payload
          },
        });
        return;
      }

      // Re-broadcast only if validated
      if (result && result.broadcast !== false) {
        broadcast(result.action, result.payload ?? payload,result.opts,seq,clientEntityId);
      }
    } else {
      // Client receives authoritative result
      handler({ world, payload, clientId, confirmed: true, seq });

      // Reconciliation for predictions
      const key = `${clientEntityId}:${seq}`;


      console.log(key)
      if (pendingPredictions.has(key)) {
        pendingPredictions.delete(key);

        // Reapply later unconfirmed predictions
        for (const [k, p] of pendingPredictions.entries()) {
          const [cid, s] = k.split(":");
          if (cid === clientEntityId && Number(s) > Number(seq)) {
            const handler = actionHandlers.get(p.action);
            if (handler) {
              handler({
                world,
                payload: p.payload,
                clientId,
                predicted: true,
                seq: Number(s),
                clientEntityId: cid,
              });
            }
          }
        }
      } 
    }
  });

  network.on("sync-error", ({ clientId, error }) => {
    const handler = errorHandlers.get(error.action);
    if (!handler) return;

    // Forward all error fields + core context
    handler({ world, clientId, ...error });
  });

  // === ECS tick hook (optional) ===
  function update(world, dt) {
    // could be used for ping/pong, periodic sync, etc
  }

  // === Public API ===
  const api = Object.assign(update, {
    send,
    onAction,
    onError,
    registerAction,
  });

  // host-only broadcast accessor (never exposed to clients)
  if (isHost) {
    api.broadcast = broadcast;
    api.sendTo = sendTo;
  }


  return api;
}
