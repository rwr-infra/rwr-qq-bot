import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoticeExecCtx } from '../types';

vi.mock('fs', () => ({
    default: {
        readFileSync: vi.fn().mockReturnValue('welcome-template'),
    },
    readFileSync: vi.fn().mockReturnValue('welcome-template'),
}));

const makeCtx = (overrides?: Partial<NoticeExecCtx>): NoticeExecCtx => {
    const base: NoticeExecCtx = {
        env: {
            PORT: 3000,
            START_MATCH: '#',
            HOSTNAME: 'localhost',
            STATIC_HTTP_PATH: 'http://localhost/static',
            REMOTE_URL: 'http://localhost:5700',
            LISTEN_GROUP: '123',
            SERVERS_MATCH_REGEX: '.*',
            SERVERS_FALLBACK_URL: '',
            ADMIN_QQ_LIST: [],
            ACTIVE_COMMANDS: [],
            WELCOME_TEMPLATE: '/tmp/welcome.txt',
            WEBSITE_DATA_FILE: '',
            TDOLL_DATA_FILE: '',
            TDOLL_SKIN_DATA_FILE: '',
            MAPS_DATA_FILE: '',
            QA_DATA_FILE: '',
            DIFY_AI_TOKEN: '',
            DIFY_AI_URL: '',
            IMGPROXY_URL: '',
            OUTPUT_BG_IMG: '',
            TOKEN: '',
            ...(overrides?.env ?? {}),
        },
        event: {
            time: Date.now(),
            self_id: 1,
            post_type: 'notice',
            notice_type: 'group_increase',
            sub_type: 'approve',
            group_id: 123,
            operator_id: 1,
            user_id: 2,
            ...(overrides?.event ?? {}),
        },
        reply: vi.fn().mockResolvedValue(undefined),
        ...(overrides ?? {}),
    };

    return base;
};

describe('welcomeNewMember', () => {
    beforeEach(async () => {
        vi.resetModules();
    });

    it('replies when listen group matches', async () => {
        const { welcomeNewMember } = await import('./welcome');
        const ctx = makeCtx();

        await welcomeNewMember(ctx);

        expect(ctx.reply).toHaveBeenCalledTimes(1);
    });

    it('skips when listen group mismatches', async () => {
        const { welcomeNewMember } = await import('./welcome');
        const ctx = makeCtx({
            event: { group_id: 999 } as NoticeExecCtx['event'],
        });

        await welcomeNewMember(ctx);

        expect(ctx.reply).not.toHaveBeenCalled();
    });
});
