import { PositionComponent, VelocityComponent, GravityComponent } from "../components/index.js";

export function PhysicsSystem(world, dt) {
  const entities = world.query([PositionComponent, VelocityComponent]);

  for (const e of entities) {
    const pos = world.getComponent(e, PositionComponent);
    const vel = world.getComponent(e, VelocityComponent);

    const gravity = world.getComponent(e, GravityComponent);
    if (gravity) {
      vel.dx += gravity.x * dt;
      vel.dy += gravity.y * dt;
    }

    pos.x += vel.dx * dt;
    pos.y += vel.dy * dt;

  }
}
