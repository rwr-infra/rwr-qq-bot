import { describe, it, expect } from 'vitest';
import { IRegister, MessageEvent } from '../types';
import { checkTimeIntervalValid } from './cmdreq';
import {awaitTimeout} from "./time";

const registerTemplate: IRegister = {
    name: 'test',
    description: '',
    isAdmin: false,
    timesInterval: 0,
    exec: async () => {
        //
    }
};

const messageTemplate: MessageEvent = {
    post_type: 'message',
    time: 0,
    self_id: 0,
    user_id: 0,
    group_id: 0,
    message: '',
    raw_message: '',
    font: 0,
    sender: {},
    sub_type: '',
    message_id: 0,
};

describe('check time utils', () => {
    describe('checkTimeIntervalValid', () => {
        it('CD 3s, request interval 2s', async () => {
            const res = checkTimeIntervalValid({
                ...registerTemplate,
                timesInterval: 3,
            }, messageTemplate);

            expect(res.success).toBe(true);

            await awaitTimeout(2000);

            const res2 = checkTimeIntervalValid({
                ...registerTemplate,
                timesInterval: 5,
            }, messageTemplate);

            expect(res2.success).toBe(false);
            expect(res2.remainingMs).toBeGreaterThan(0);
            expect(res2.remainingMs).toBeLessThanOrEqual(3000);
        });

        it('CD 3s, diffent user request', async () => {
            const res = checkTimeIntervalValid({
                ...registerTemplate,
                timesInterval: 3,
            }, {
                ...messageTemplate,
                user_id: 2
            });

            expect(res.success).toBe(true);

            const res2 = checkTimeIntervalValid({
                ...registerTemplate,
                timesInterval: 5,
            }, {
                ...messageTemplate,
                user_id: 3
            });

            expect(res2.success).toBe(true);
        });

        it('CD 3s, request interval 4s', async () => {
            const res = checkTimeIntervalValid({
                ...registerTemplate,
                timesInterval: 3,
            }, {
                ...messageTemplate,
                user_id: 4
            });

            expect(res.success).toBe(true);

            await awaitTimeout(4000);

            const res2 = checkTimeIntervalValid({
                ...registerTemplate,
                timesInterval: 3,
            }, {
                ...messageTemplate,
                user_id: 4
            });

            expect(res2.success).toBe(true);
        });
    });
});
