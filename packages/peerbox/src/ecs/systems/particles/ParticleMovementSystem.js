import { PositionComponent,LifetimeComponent,MovementPatternComponent } from "../../components/index.js";
import { Kinematics } from "../../kinematics.js";

export function ParticleMovementSystem(world, dt) {
  const particles = world.query([MovementPatternComponent]);
  for (const e of particles) {
    const move = world.getComponent(e, MovementPatternComponent);
    const kinematic = Kinematics.get(move.type);
    if (kinematic) kinematic({ world, entity: e, dt, params: move.params });
  }
}