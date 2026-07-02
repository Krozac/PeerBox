const toastTimers = new Map(); // system-level tracking

import { ToastComponent, HtmlRenderComponent } from '../components/index.js';

function setupToastListener(world) {
  // Ensure we only add the listener once
  if (setupToastListener.listenerAdded) return;
  setupToastListener.listenerAdded = true;

  window.addEventListener('toast', (e) => {
    const { message, duration, parentSelector,type } = e.detail;

    // Create a new ECS entity for the toast
    const id = world.createEntity();

    world.addComponent(id, ToastComponent, { duration, remainingTime: duration, type: type || 'info' });
    world.addComponent(id, HtmlRenderComponent, {
      html: message,
      classes: ['pb-toast', `pb-toast--${type || 'info'}`],
      parentSelector: parentSelector || '#toast-container'
    });
  });
}


export function ToastSystem(world, dt) {
  const toastEntities = world.query([ToastComponent]);

  setupToastListener(world);

  for (const id of toastEntities) {
    const toast = world.getComponent(id, ToastComponent);
    if (!toast) continue;

    // Initialize timer if it doesn't exist yet
    if (!toastTimers.has(id)) {
      toastTimers.set(id, toast.duration ?? 3000);
    }

    // Decrement timer
    const remaining = toastTimers.get(id) - dt;

    if (remaining <= 0) {
      // Remove toast entity
      world.removeEntities([id]);
      toastTimers.delete(id);
    } else {
      toastTimers.set(id, remaining);
    }
  }
}
