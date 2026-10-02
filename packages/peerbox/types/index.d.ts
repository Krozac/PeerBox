export type EntityId = string | number;
export type ComponentData = Record<string, unknown>;
export type PeerBoxEvent = (...args: any[]) => void;

export class World {
  [key: string]: any;
  constructor(options?: { idGenerator?: () => EntityId });
}

export class GameLoop { [key: string]: any; constructor(...args: any[]); }
export class Scene { [key: string]: any; constructor(...args: any[]); }
export class SceneManager { [key: string]: any; constructor(...args: any[]); }
export class TransitionManager { [key: string]: any; constructor(...args: any[]); }

export const Components: Record<string, any>;
export const Systems: Record<string, any>;
export const Utils: Record<string, any>;
export const User: Record<string, any>;
export const Kinematics: any;
export function SyncSystem(options: Record<string, any>): any;

export interface HostConfig {
  url: string;
  rtcConfiguration?: Record<string, unknown>;
  peerReconnectGracePeriod?: number;
  shared?: Record<string, unknown>;
  plugins?: Array<{ install?: (context: any) => void }>;
}

export interface ClientConfig extends HostConfig {
  roomId: string;
  username: string;
}

export interface PeerBoxConnection {
  on(event: string, callback: PeerBoxEvent): void;
  send(message: unknown, ...args: any[]): any;
  connect?(): Promise<void>;
  disconnect?(): void;
  start?(): void;
  server: any;
  peers?: any;
  peer?: any;
}
