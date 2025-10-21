export class HostReconnectManager {
  constructor(host) {
    this.host = host;
    this.retryDelays = [1000, 2000, 5000];
    this.retryTimers = new Map();
    this.reconnectingPeers = new Set();
    this.callbacks = {
      onAttempt: () => {},
      onSuccess: () => {},
      onFail: () => {},
    };
  }

  configure({ onAttempt, onSuccess, onFail }) {
    if (onAttempt) this.callbacks.onAttempt = onAttempt;
    if (onSuccess) this.callbacks.onSuccess = onSuccess;
    if (onFail) this.callbacks.onFail = onFail;
  }

  handleDisconnect(clientId) {
    if (this.reconnectingPeers.has(clientId)) return;
    this.reconnectingPeers.add(clientId);

    const maxAttempts = 5;
    let attempt = 0;
    const retry = async () => {
        this.callbacks.onAttempt?.(clientId, attempt);

        const ok = await this.host.peers.tryReconnect(clientId).catch((e) => {
        console.warn('tryReconnect error', e);
        return false;
        });

        if (ok) {
        this.callbacks.onSuccess?.(clientId);
        this.reconnectingPeers.delete(clientId);
        return;
        }

        attempt++;
        if (attempt > maxAttempts) {
        this.callbacks.onFail?.(clientId);
        this.reconnectingPeers.delete(clientId);
        return;
        }

        // exponential backoff
        const delay = Math.min(5000, 1000 * Math.pow(2, attempt));
        setTimeout(retry, delay);
    };

    // start first attempt after a small delay to break synchronous chain
    setTimeout(retry, 200);
    }
}
