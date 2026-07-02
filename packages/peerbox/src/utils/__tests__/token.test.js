import { describe, it, expect } from 'vitest';
import { tokenize, detokenise } from '../token.js';

describe('tokenise and detokenise', () => {
    const secret = 'my_secret_key';
    const params = { userId: 123, role: 'admin' };

    it('correctly tokenises and detokenises parameters', async () => {
        const token = await tokenize(secret, params);
        expect(typeof token).toBe('string');
        const decoded = await detokenise(secret, token);
        expect(decoded).toEqual(params);
    });

    it('throws an error for invalid token format', async () => {
        const invalidToken = 'invalid.token.format';
        await expect(detokenise(secret, invalidToken)).rejects.toThrow('Invalid token format');
    });

    it('throws an error for invalid token signature', async () => {
        const token = await tokenize(secret, params);
        const tamperedToken = token.replace(/.$/, 'X'); // Modify the token slightly
        await expect(detokenise(secret, tamperedToken)).rejects.toThrow('Invalid token signature');
    });             
});
