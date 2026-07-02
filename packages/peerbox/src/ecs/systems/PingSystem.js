export function PingSystem(client, options = {}) {
  const interval = options.interval || 2000;
  let lastPingSent = 0;
  let pingId = 0;
  const pending = new Map();

  return (world, deltaTime) => {

    // listen once per system
    if (!client._pingBound) {
      client.on("pong", (msg) => {
        if (pending.has(msg.id)) {
          const sentAt = pending.get(msg.id);
          const rtt = Date.now() - sentAt;
          pending.delete(msg.id);
          console.log("RTT ",rtt)
          world.emit("ping-update", { rtt, id: msg.id });
        }
      });
      client._pingBound = true;
    }

    lastPingSent += deltaTime;
    if (lastPingSent >= interval) {
      lastPingSent = 0;
      const id = pingId++;  
      pending.set(id, Date.now());
      client.send({ type: "ping", id });
    }
  };
}
