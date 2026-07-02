export function ParticleEmitterComponent(){
    return {
        rate: 50, // particles per second
        burst: 0, // optional: emit N particles instantly
        timeSinceLast: 0, // internal timer
        maxParticles: 200,
        active: true,
        
        // Particle definition function (data-driven)
        spawnParticle: (world, emitterEntity) => {},
        }
}