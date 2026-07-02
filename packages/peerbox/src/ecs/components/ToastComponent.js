export function ToastComponent({duration = 3000, type = 'info' } = {}) {
  return {
    duration,
    type,
  };
}