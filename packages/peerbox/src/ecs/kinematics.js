
import { PositionComponent,LifetimeComponent,GravityComponent,VelocityComponent } from "./components";

// peerbox/kinematics.js
export const Kinematics = new Map();

// Spiral movement (only needs Position and Lifetime)
Kinematics.set("spiral", ({ world, entity, dt, params }) => {
  const pos = world.getComponent(entity, PositionComponent);
  const life = world.getComponent(entity, LifetimeComponent);
  if (!pos || !life) return;

  const t = life.age;
  const angle = t * params.angularSpeed;
  const radius = params.radiusGrowth * t;
  pos.x = params.originX + Math.cos(angle) * radius;
  pos.y = params.originY + Math.sin(angle) * radius;
});

// Gravity movement (needs Position and Velocity)
Kinematics.set("wave", ({ world, entity, dt, params }) => {
  const pos = world.getComponent(entity, PositionComponent);
  const life = world.getComponent(entity, LifetimeComponent);
  if (!pos || !life) return;

  const t = life.age;
  pos.x += params.speedX * dt;
  pos.y = params.originY + Math.sin(t * params.frequency) * params.amplitude;
});

Kinematics.set("drift", ({ world, entity, dt, params }) => {
  const pos = world.getComponent(entity, PositionComponent);
  if (!pos) return;

  pos.x += (Math.random() - 0.5) * params.speed * dt;
  pos.y += (Math.random() - 0.5) * params.speed * dt;
});

Kinematics.set("custom", ({ pos, dt, life, params }) => {
  params.fn?.(pos, dt, life);
});