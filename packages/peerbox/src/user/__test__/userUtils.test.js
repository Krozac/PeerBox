import { describe, it, expect } from 'vitest';
import { getById } from '../userUtils';
import { World } from '../../ecs/core/world.js';
import { userComponent } from '../../ecs/components/index.js';

describe('getById', () => {
    it('returns the user component with the matching ID', () => {
        const world = new World();
        const user = world.createEntity();
        world.addComponent(user, userComponent, { id: 'user-123' });
        const found = getById('user-123', world);
        expect(found).toBe(user);
    });
    
    it('returns null if no user with the given ID exists', () => {
        const world = new World();
        const user = userComponent(world);
        world.createEntity(user);
        const found = getById('nonexistent-id', world);
        expect(found).toBeNull();
    });
});