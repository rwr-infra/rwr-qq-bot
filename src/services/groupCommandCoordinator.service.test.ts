import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    GroupCommandCoordinator,
    ApiResult,
} from './groupCommandCoordinator.service';

const GROUP = 1;
const CMD = 'servers';
const PARAMS = {};
/** 固定基准时间(2023-11-14)，避免 Date.now()=0 时首个请求被误判为冷却中 */
const BASE = 1_700_000_000_000;

function makeResult(outputFile = 'out.png'): ApiResult {
    return { serverList: [], outputFile };
}

/** 手动可控的 deferred，用于精确编排 apiCall 的完成时机 */
function deferred<T>() {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe('GroupCommandCoordinator', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(BASE);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('第一个发起者返回 isFirstRequester，不需要等待', async () => {
        const c = new GroupCommandCoordinator();
        const res = await c.executeWithGroupCD(GROUP, CMD, PARAMS, 111, () =>
            Promise.resolve(makeResult()),
        );

        expect(res.status).toBe('processing');
        expect(res.isFirstRequester).toBe(true);
        expect(res.needWait).toBe(false);
        expect(res.pendingRequest?.qqList).toEqual([111]);
    });

    it('并发相同参数请求被合并到同一 pending 队列', async () => {
        const c = new GroupCommandCoordinator();
        const d = deferred<ApiResult>();

        const first = await c.executeWithGroupCD(
            GROUP,
            CMD,
            PARAMS,
            111,
            () => d.promise,
        );
        const second = await c.executeWithGroupCD(
            GROUP,
            CMD,
            PARAMS,
            222,
            () => d.promise,
        );

        expect(first.isFirstRequester).toBe(true);
        expect(second.isFirstRequester).toBe(false);
        expect(second.needWait).toBe(true);
        // 同一个 pending 对象
        expect(second.pendingRequest).toBe(first.pendingRequest);
        expect(first.pendingRequest?.qqList).toEqual([111, 222]);

        d.resolve(makeResult());
        await first.pendingRequest!.promise;
    });

    it('getAndClearWaiters 返回全部等待者(含发起者)且只返回一次', async () => {
        const c = new GroupCommandCoordinator();
        const d = deferred<ApiResult>();

        await c.executeWithGroupCD(GROUP, CMD, PARAMS, 111, () => d.promise);
        await c.executeWithGroupCD(GROUP, CMD, PARAMS, 222, () => d.promise);
        await c.executeWithGroupCD(GROUP, CMD, PARAMS, 333, () => d.promise);

        const waiters = c.getAndClearWaiters(GROUP, CMD, PARAMS);
        expect(waiters).toEqual([111, 222, 333]);

        // 第二次调用队列已清空——这是防重复回复的关键
        const again = c.getAndClearWaiters(GROUP, CMD, PARAMS);
        expect(again).toEqual([]);

        d.resolve(makeResult());
    });

    it('同群相同命令在 CD 内被冷却拦截', async () => {
        const c = new GroupCommandCoordinator({ defaultCD: 5000 });

        const first = await c.executeWithGroupCD(GROUP, CMD, PARAMS, 111, () =>
            Promise.resolve(makeResult()),
        );
        // 等待第一次请求真正完成（isCompleted=true），否则会被当作合并
        await first.pendingRequest!.promise;

        await vi.advanceTimersByTimeAsync(1000); // CD 内
        const second = await c.executeWithGroupCD(GROUP, CMD, PARAMS, 222, () =>
            Promise.resolve(makeResult()),
        );

        expect(second.status).toBe('cooldown');
        expect(second.remainingMs).toBe(4000);
    });

    it('已完成的 pending 不会被误合并——CD 过后可发起新请求', async () => {
        const c = new GroupCommandCoordinator({ defaultCD: 5000 });

        const first = await c.executeWithGroupCD(GROUP, CMD, PARAMS, 111, () =>
            Promise.resolve(makeResult()),
        );
        await first.pendingRequest!.promise; // isCompleted = true

        await vi.advanceTimersByTimeAsync(6000); // CD 已过
        const second = await c.executeWithGroupCD(GROUP, CMD, PARAMS, 222, () =>
            Promise.resolve(makeResult()),
        );

        // 应发起全新请求，而不是加入已完成的旧队列
        expect(second.isFirstRequester).toBe(true);
        expect(second.pendingRequest).not.toBe(first.pendingRequest);
        expect(second.pendingRequest?.qqList).toEqual([222]);
    });

    it('skipCDCheck 跳过冷却检查', async () => {
        const c = new GroupCommandCoordinator({ defaultCD: 5000 });

        const first = await c.executeWithGroupCD(GROUP, CMD, PARAMS, 111, () =>
            Promise.resolve(makeResult()),
        );
        await first.pendingRequest!.promise;

        await vi.advanceTimersByTimeAsync(1000);
        const second = await c.executeWithGroupCD(
            GROUP,
            CMD,
            PARAMS,
            222,
            () => Promise.resolve(makeResult()),
            { skipCDCheck: true },
        );

        expect(second.status).toBe('processing');
        expect(second.isFirstRequester).toBe(true);
    });

    it('延迟清理仅删除仍属于本次的 pending 记录', async () => {
        const c = new GroupCommandCoordinator({
            defaultCD: 5000,
            cleanupDelay: 60000,
        });

        // 第一次请求完成——其清理定时器计划在 +60000 触发
        const first = await c.executeWithGroupCD(GROUP, CMD, PARAMS, 111, () =>
            Promise.resolve(makeResult()),
        );
        await first.pendingRequest!.promise;

        // CD 过后发起新请求，复用同一 cacheKey（覆盖旧 pending）
        await vi.advanceTimersByTimeAsync(6000);
        const d = deferred<ApiResult>();
        const second = await c.executeWithGroupCD(
            GROUP,
            CMD,
            PARAMS,
            222,
            () => d.promise,
        );
        expect(c.getStats().pendingCount).toBe(1);

        // 推进到第一次请求的清理定时器触发点：旧定时器不应删除已被覆盖的新 pending
        await vi.advanceTimersByTimeAsync(54000);
        expect(c.getStats().pendingCount).toBe(1);
        expect(c.getAndClearWaiters(GROUP, CMD, PARAMS)).toEqual([222]);

        d.resolve(makeResult());
        await second.pendingRequest!.promise;
    });

    it('waitForResult 在超时时拒绝', async () => {
        const c = new GroupCommandCoordinator({ requestTimeout: 30000 });
        const d = deferred<ApiResult>();

        const first = await c.executeWithGroupCD(
            GROUP,
            CMD,
            PARAMS,
            111,
            () => d.promise,
        );

        const waitPromise = c.waitForResult(first.pendingRequest!);
        const assertion = expect(waitPromise).rejects.toThrow('Request timeout');

        await vi.advanceTimersByTimeAsync(30000);
        await assertion;

        // 收尾：让底层请求结算，避免悬挂
        d.resolve(makeResult());
    });

    it('waitForResult 正常返回 apiCall 结果', async () => {
        const c = new GroupCommandCoordinator();
        const d = deferred<ApiResult>();

        const first = await c.executeWithGroupCD(
            GROUP,
            CMD,
            PARAMS,
            111,
            () => d.promise,
        );

        const waitPromise = c.waitForResult(first.pendingRequest!);
        d.resolve(makeResult('done.png'));

        const result = await waitPromise;
        expect(result.outputFile).toBe('done.png');
    });

    it('generateAtMessage 生成批量 AT 前缀', () => {
        const c = new GroupCommandCoordinator();
        const msg = c.generateAtMessage([111, 222], 'hello');
        expect(msg).toBe('[CQ:at,qq=111] [CQ:at,qq=222]\nhello');
    });

    it('不同参数不会互相合并到同一队列', async () => {
        // CD 键是 groupId:command（与参数无关），故用 skipCDCheck 隔离出"合并"这一维度
        const c = new GroupCommandCoordinator();
        const d = deferred<ApiResult>();
        const opts = { skipCDCheck: true };

        const a = await c.executeWithGroupCD(
            GROUP,
            CMD,
            { q: 'a' },
            111,
            () => d.promise,
            opts,
        );
        const b = await c.executeWithGroupCD(
            GROUP,
            CMD,
            { q: 'b' },
            222,
            () => d.promise,
            opts,
        );

        expect(a.isFirstRequester).toBe(true);
        expect(b.isFirstRequester).toBe(true);
        expect(b.pendingRequest).not.toBe(a.pendingRequest);
        expect(a.pendingRequest?.qqList).toEqual([111]);
        expect(b.pendingRequest?.qqList).toEqual([222]);

        d.resolve(makeResult());
    });
});
