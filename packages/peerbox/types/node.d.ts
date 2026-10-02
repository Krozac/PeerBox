import type { HostConfig, PeerBoxConnection } from "./index";

export * from "./index";

export function createHost(config: HostConfig): PeerBoxConnection;
