import * as fs from 'node:fs';
import * as path from 'node:path';
import { ImageLike, loadImageFrom } from '../../../services/canvasBackend';
import { resizeImg } from '../../../utils/imgproxy';
import { logger } from '../../../utils/logger';
import { TDOLL_URL_PREFIX } from '../types/constants';
import { ITDollDataItem } from '../types/types';
import type { SkinGridItem } from './skinGridRenderer';

/** 卡片头像显示尺寸(经 resizeImg 请求同尺寸) */
export const AVATAR_RENDER_SIZE = 48;
/** 皮肤缩略图尺寸(维持旧实现) */
export const SKIN_IMG_SIZE = 150;

/** mod 版头像在缓存 Map 中的 key(沿用旧 TDollDataProvider 约定) */
export const getModAvatarKey = (id: string): string => `${id}__mod`;

/**
 * 并发加载人形头像(含 mod 版), 逐项容错: 单张失败仅记录日志, 渲染占位。
 */
export const loadTDollAvatarMap = async (
    tdolls: ITDollDataItem[],
): Promise<Map<string, ImageLike>> => {
    const imgMap = new Map<string, ImageLike>();

    await Promise.all(
        tdolls.map(async (tdoll) => {
            try {
                const img = await loadImageFrom(
                    resizeImg(
                        tdoll.avatar,
                        AVATAR_RENDER_SIZE,
                        AVATAR_RENDER_SIZE,
                    ),
                );
                imgMap.set(tdoll.id, img);
            } catch (error) {
                logger.error('[tdoll] Failed to load avatar', {
                    id: tdoll.id,
                    error,
                });
            }

            if (tdoll.mod === '1' && tdoll.avatarMod) {
                try {
                    const modImg = await loadImageFrom(
                        resizeImg(
                            tdoll.avatarMod,
                            AVATAR_RENDER_SIZE,
                            AVATAR_RENDER_SIZE,
                        ),
                    );
                    imgMap.set(getModAvatarKey(tdoll.id), modImg);
                } catch (error) {
                    logger.error('[tdoll] Failed to load mod avatar', {
                        id: tdoll.id,
                        error,
                    });
                }
            }
        }),
    );

    return imgMap;
};

/**
 * 解析皮肤图地址:
 * - 已是完整 URL(http/https/data:) → 原样
 * - 本地绝对路径且存在 → 原样(图像回归 fixture 用)
 * - 其余(gfwiki 相对路径) → 拼接 TDOLL_URL_PREFIX
 */
export const resolveSkinImageUrl = (pic: string): string => {
    if (!pic) {
        return pic;
    }
    if (/^(https?:\/\/|data:)/.test(pic)) {
        return pic;
    }
    if (path.isAbsolute(pic) && fs.existsSync(pic)) {
        return pic;
    }
    return `${TDOLL_URL_PREFIX}${pic}`;
};

/**
 * 并发加载皮肤图, key = skin.value; 逐项容错, 失败项不入 map(渲染占位格)。
 */
export const loadSkinImageMap = async (
    items: SkinGridItem[],
): Promise<Map<string, ImageLike>> => {
    const imgMap = new Map<string, ImageLike>();

    await Promise.all(
        items.map(async (item) => {
            if (!item.pic) {
                return;
            }
            try {
                const url = resolveSkinImageUrl(item.pic);
                const img = await loadImageFrom(
                    resizeImg(url, SKIN_IMG_SIZE, SKIN_IMG_SIZE),
                );
                imgMap.set(item.value, img);
            } catch (error) {
                logger.error('[tdoll] Failed to load skin image', {
                    value: item.value,
                    error,
                });
            }
        }),
    );

    return imgMap;
};
