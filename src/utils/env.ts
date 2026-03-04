import dotenv from 'dotenv';
import { GlobalEnv } from '../types';
import { logger } from './logger';

function stripWrappingQuotes(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length >= 2) {
        const first = trimmed[0];
        const last = trimmed[trimmed.length - 1];
        const isWrappedBySingle = first === "'" && last === "'";
        const isWrappedByDouble = first === '"' && last === '"';
        if (isWrappedBySingle || isWrappedByDouble) {
            return trimmed.slice(1, -1);
        }
    }
    return trimmed;
}

function parseJsonArray(value: string): unknown[] | null {
    const normalized = stripWrappingQuotes(value);
    try {
        const parsed: unknown = JSON.parse(normalized);
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function parseNumberArray(value: string): number[] {
    const arr = parseJsonArray(value);
    if (!arr) {
        return [];
    }
    const nums = arr
        .map((x) => {
            if (typeof x === 'number') {
                return x;
            }
            if (typeof x === 'string') {
                const n = Number(x);
                return Number.isFinite(n) ? n : null;
            }
            return null;
        })
        .filter((x): x is number => x !== null);
    return nums;
}

function parseStringArray(value: string): string[] {
    const arr = parseJsonArray(value);
    if (!arr) {
        return [];
    }
    return arr
        .map((x) => (typeof x === 'string' ? x : null))
        .filter((x): x is string => x !== null);
}

function parseStartMatch(value: string): string {
    const normalized = stripWrappingQuotes(value);
    try {
        const parsed: unknown = JSON.parse(normalized);
        if (typeof parsed === 'string' && parsed.trim()) {
            return parsed.trim();
        }
    } catch {
        // ignore
    }
    return normalized;
}

export function loadEnv(): GlobalEnv {
    dotenv.config();
    const _env = process.env as Record<string, string>;

    logger.info('_env: ACTIVE_COMMANDS', _env.ACTIVE_COMMANDS);

    const env = {
        ..._env,
        ADMIN_QQ_LIST: parseNumberArray(_env.ADMIN_QQ_LIST ?? '[]'),
        PORT: parseInt(_env.PORT || '3000'),
        ACTIVE_COMMANDS: parseStringArray(_env.ACTIVE_COMMANDS ?? '[]'),
    } as GlobalEnv;

    try {
        env.START_MATCH = parseStartMatch(_env.START_MATCH);
    } catch (e) {
        // ignore
    }

    return env;
}
