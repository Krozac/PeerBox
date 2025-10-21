export class World {
  constructor() {
    this.entities = new Map();
    this.systems = [];
    this.components = new Map(); // Map of entityId → componentName → data
    this.nextEntityId = 1;
  }

  createEntity(initialComponents = {}) {
    const id = this.nextEntityId++;
    this.entities.set(id, true);
    this.components.set(id, new Map());
    for (const [name, value] of Object.entries(initialComponents)) {
      this.addComponent(id, name, value);
    }
    return id;
  }

  addComponent(entityId, name, data) {
    this.components.get(entityId).set(name, data);
  }

  getComponent(entityId, name) {
    return this.components.get(entityId)?.get(name);
  }

  query(componentNames) {
    return Array.from(this.entities.keys()).filter(id => {
      const comps = this.components.get(id);
      return componentNames.every(name => comps?.has(name));
    });
  }

  removeEntities(entityIds) {
    for (const id of entityIds) {
      console.log(`Removing entity ${id}`);
      this.entities.delete(id);
      this.components.delete(id);
    }
  }

  registerSystem(systemFn) {
    this.systems.push(systemFn);
  }

  update(deltaTime) {
    for (const system of this.systems) {
      system(this, deltaTime);
    }
  }
}
