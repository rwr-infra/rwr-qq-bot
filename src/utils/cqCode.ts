import { GlobalEnv } from '../types';
import { getStaticHttpPath } from './cmdreq';

/**
 * CQ 码构造——集中拥有 go-cqhttp 消息段的编码格式，避免在各命令里手拼字符串。
 */

export interface CqImageOptions {
    /** 是否使用缓存(0 表示禁用)。省略则不带该字段 */
    cache?: number;
    /** 图片处理线程数(go-cqhttp 的 c 参数)。省略则不带该字段 */
    c?: number;
    /** 特殊展示类型，如 'flash'(闪照)。省略则普通图片 */
    type?: 'flash';
}

function encodeImage(file: string, opts: CqImageOptions): string {
    const parts = [`file=${file}`];
    if (opts.cache !== undefined) {
        parts.push(`cache=${opts.cache}`);
    }
    if (opts.c !== undefined) {
        parts.push(`c=${opts.c}`);
    }
    if (opts.type) {
        parts.push(`type=${opts.type}`);
    }
    return `[CQ:image,${parts.join(',')}]`;
}

/**
 * 由 out/ 下的本地渲染文件名生成 CQ 图片码。
 * 文件名经 {@link getStaticHttpPath} 映射为 go-cqhttp 可访问的 HTTP 地址。
 * 默认 `cache=0,c=8`(与历史各命令一致)。
 */
export function cqImageFile(
    env: GlobalEnv,
    fileName: string,
    opts: CqImageOptions = { cache: 0, c: 8 },
): string {
    return encodeImage(getStaticHttpPath(env, fileName), opts);
}

/**
 * 由外部 URL 生成 CQ 图片码。默认不附带任何参数(裸图片)。
 */
export function cqImageUrl(url: string, opts: CqImageOptions = {}): string {
    return encodeImage(url, opts);
}
