import type { ClientConfig, HostConfig, PeerBoxConnection } from "./index";

export * from "./index";

export function createHost(config: HostConfig): PeerBoxConnection;
export function createClient(config: ClientConfig): PeerBoxConnection;
