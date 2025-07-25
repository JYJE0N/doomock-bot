// src/core/DIContainer.js
class DIContainer {
  constructor() {
    this.services = new Map();
    this.singletons = new Map();
  }

  register(name, factory, options = {}) {
    this.services.set(name, {
      factory,
      singleton: options.singleton !== false, // 기본값 true
    });
  }

  get(name) {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not registered`);
    }

    if (service.singleton) {
      if (!this.singletons.has(name)) {
        this.singletons.set(name, service.factory(this));
      }
      return this.singletons.get(name);
    }

    return service.factory(this);
  }

  has(name) {
    return this.services.has(name);
  }

  clear() {
    this.singletons.clear();
  }
}

module.exports = new DIContainer();
