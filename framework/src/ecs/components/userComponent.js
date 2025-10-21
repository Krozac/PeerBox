export function userComponent({ id, name = 'Default User' }) {
  return {
    id,
    name,
    role: 'client', // Default role, can be 'host' or 'client'
  };
    
}