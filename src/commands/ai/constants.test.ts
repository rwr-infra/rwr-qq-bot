import { describe, it, expect } from 'vitest';
import { AI_MODEL_NAME, AI_MODEL_DISPLAY_NAME } from './constants';

describe('AI constants', () => {
    describe('AI_MODEL_NAME', () => {
        it('should be rwr-agent', () => {
            expect(AI_MODEL_NAME).toBe('rwr-agent');
        });

        it('should be a non-empty string', () => {
            expect(typeof AI_MODEL_NAME).toBe('string');
            expect(AI_MODEL_NAME.length).toBeGreaterThan(0);
        });
    });

    describe('AI_MODEL_DISPLAY_NAME', () => {
        it('should be [RWR-Agent]', () => {
            expect(AI_MODEL_DISPLAY_NAME).toBe('[RWR-Agent]');
        });

        it('should be wrapped in square brackets', () => {
            expect(AI_MODEL_DISPLAY_NAME.startsWith('[')).toBe(true);
            expect(AI_MODEL_DISPLAY_NAME.endsWith(']')).toBe(true);
        });

        it('should contain the model name reference', () => {
            expect(AI_MODEL_DISPLAY_NAME.toLowerCase()).toContain('rwr-agent');
        });
    });
});