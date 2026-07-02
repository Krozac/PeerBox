export function userComponent({ id, name = 'Default User',  connected = true, }) {
  return {
    id,
    name,
    role: 'client', // Default role, can be 'host' or 'client'
    connected,
  };
    
}