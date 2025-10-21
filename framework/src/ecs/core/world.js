export class World {
  constructor({ idGenerator } = {}) {
    this.entities = new Map();
    this.updateSystems = [];
    this.renderSystems = [];
    this.components = new Map(); // Map of entityId → componentName → data
    this.nextEntityId = 1;

    this._idGenerator =
      idGenerator || (() => this.nextEntityId++);

    this._listeners = new Map(); // eventName → Set<callback>
  }

  // --- Event emitter API ---
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
  }

  off(event, callback) {
    this._listeners.get(event)?.delete(callback);
  }

  emit(event, data) {
    this._listeners.get(event)?.forEach((cb) => cb(data));
  }

  // --- ECS API ---
  clear() {
    this.entities.clear();
    this.components.clear();
    this.nextEntityId = 1;
    this.emit("clear");
  }

  createEntity(initialComponents = {}) {
    const id = this._idGenerator();
    this.entities.set(id, true);
    this.components.set(id, new Map());

    for (const [name, value] of Object.entries(initialComponents)) {
      this.addComponent(id, name, value);
    }
    
    this.emit("entityCreated", id);
    return id;
  }

  addComponent(entityId, name, data) {
    this.components.get(entityId).set(name, data);
    this.emit("componentAdded", { entityId, name, data });
  }

  getComponent(entityId, name) {
    return this.components.get(entityId)?.get(name);
  }

  query(componentNames) {
    return Array.from(this.entities.keys()).filter((id) => {
      const comps = this.components.get(id);
      return componentNames.every((name) => comps?.has(name));
    });
  }

  removeEntities(entityIds) {
    for (const id of entityIds) {
      this.entities.delete(id);
      this.components.delete(id);
      this.emit("entityRemoved", id);
    }
  }

  registerSystem(systemFn, { type = "update" } = {}) {
    if (type === "render") this.renderSystems.push(systemFn);
    else this.updateSystems.push(systemFn);
    this.emit("systemRegistered", systemFn);
  }

  update(deltaTime) {
    for (const system of this.updateSystems) {
      system(this, deltaTime);
    }
    this.emit("update", deltaTime);
  }

  render(deltaTime) {
    for (const system of this.renderSystems) {
      system(this, deltaTime);
    }
    this.emit("render", deltaTime);
  }
}
