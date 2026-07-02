import {
  LifetimeComponent,
  VelocityComponent,
  PositionComponent,
  ParticleEmitterComponent,
  ParticleTag
} from "../../components/index.js";

export function ParticleSystem(world, dt, { MAX = 1000 } = {}) {
  const emitters = world.query([ParticleEmitterComponent]);
  const particles = world.query([ParticleTag]);
  const toRemove = [];

  const frameDt = Math.min(dt, 0.1);

  for (const emitter of emitters) {
    const comp = world.getComponent(emitter, ParticleEmitterComponent);
    if (!comp.active) continue;

    switch (comp.mode || "continuous") {
      case "continuous": {
        comp.timeSinceLast += frameDt;
        const interval = 1 / comp.rate;

        while (comp.timeSinceLast >= interval && particles.length < MAX) {
          comp.spawnParticle(world, emitter);
          comp.timeSinceLast -= interval;
        }

        if (comp.timeSinceLast > interval) comp.timeSinceLast = 0;
        break;
      }

      case "burst": {
        comp.timeSinceLast += frameDt;
        if (comp.timeSinceLast >= (comp.burstDelay || 1)) {
          const burstCount = comp.burstCount || 10;
          for (let i = 0; i < burstCount && particles.length < MAX; i++) {
            comp.spawnParticle(world, emitter);
          }
          comp.timeSinceLast = 0;
        }
        break;
      }

      case "custom":
        comp.emitFn?.(world, emitter, frameDt);
        break;
    }
  }

  for (const p of particles) {
    const life = world.getComponent(p, LifetimeComponent);
    life.age += frameDt;
    if (life.age >= life.value) toRemove.push(p);
  }

  if (toRemove.length > 0) world.removeEntities(toRemove);
}
