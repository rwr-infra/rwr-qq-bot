import { describe, it, expect } from 'vitest';
import { allCommands, resolveActiveCommands } from './registry';
import { GlobalEnv } from '../types';

describe('command registry', () => {
    it('has no undefined entries (guards the registry<->help import cycle)', () => {
        expect(allCommands.length).toBeGreaterThan(0);
        expect(allCommands.every((c) => c && typeof c.name === 'string')).toBe(
            true,
        );
    });

    it('registers help as a normal command (name + alias)', () => {
        const help = allCommands.find((c) => c.name === 'help');
        expect(help).toBeDefined();
        expect(help?.alias).toBe('h');
        expect(typeof help?.exec).toBe('function');
    });

    it('resolveActiveCommands returns all when ACTIVE_COMMANDS is undefined', () => {
        const env = {} as GlobalEnv;
        expect(resolveActiveCommands(env)).toHaveLength(allCommands.length);
    });

    it('resolveActiveCommands returns all when ACTIVE_COMMANDS is an empty array', () => {
        // loadEnv 把未设置的变量解析为 []; 空数组应等同"未限制"，启用全部
        const env = { ACTIVE_COMMANDS: [] } as unknown as GlobalEnv;
        expect(resolveActiveCommands(env)).toHaveLength(allCommands.length);
    });

    it('resolveActiveCommands filters by ACTIVE_COMMANDS', () => {
        const env = { ACTIVE_COMMANDS: ['help', 'servers'] } as GlobalEnv;
        const names = resolveActiveCommands(env).map((c) => c.name);
        expect(names.sort()).toEqual(['help', 'servers']);
    });
});
