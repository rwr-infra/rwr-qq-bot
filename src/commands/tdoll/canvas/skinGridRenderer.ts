import { Canvas2DContext, ImageLike } from '../../../services/canvasBackend';
import { buildCanvasFont } from '../../../services/canvasFonts';
import { roundRectPath, truncate } from '../../../services/canvasHelpers';
import { CANVAS_COLORS } from '../../../services/canvasTheme';
import { ITDollSkinDataItem } from '../types/types';
import { SKIN_IMG_SIZE } from './assets';

export const SKIN_GRID_COLS = 3;
export const SKIN_CELL_W = 166; // 150 图 + 8*2 内边距
const CELL_PAD = 8;
const CELL_RADIUS = 10;
const NAME_ROW_H = 24;
const ID_ROW_H = 20;
export const SKIN_CELL_H =
    CELL_PAD + SKIN_IMG_SIZE + NAME_ROW_H + ID_ROW_H + CELL_PAD; // 150 图 + 名称行 + ID 行 + 上下留白 = 210
export const SKIN_GRID_GAP = 12;
export const SKIN_GRID_W =
    SKIN_GRID_COLS * SKIN_CELL_W + (SKIN_GRID_COLS - 1) * SKIN_GRID_GAP; // 522

const EMPTY_HINT_H = 40;

export interface SkinGridItem {
    seq: number;
    title: string;
    value: string;
    pic?: string;
}

/**
 * 从皮肤记录构建网格项(沿用旧过滤规则: image/index/title/value 必须齐全)。
 */
export const buildSkinGridItems = (
    skins: ITDollSkinDataItem | undefined,
): SkinGridItem[] => {
    if (!skins?.length) {
        return [];
    }

    return skins
        .filter((skin) =>
            Boolean(
                skin &&
                    skin.image &&
                    skin.index !== undefined &&
                    skin.title &&
                    skin.value,
            ),
        )
        .map((skin) => ({
            seq: skin.index + 1,
            title: skin.title,
            value: skin.value,
            pic: skin.image?.pic,
        }));
};

/** 网格总高(纯算式, 可单测); 0 项返回占位行高 */
export const measureSkinGridHeight = (itemCount: number): number => {
    if (itemCount <= 0) {
        return EMPTY_HINT_H;
    }
    const rows = Math.ceil(itemCount / SKIN_GRID_COLS);
    return rows * SKIN_CELL_H + (rows - 1) * SKIN_GRID_GAP;
};

/**
 * 在 (x, y) 绘制 3 列皮肤网格, 返回网格底部 y。
 */
export const drawSkinGrid = (
    ctx: Canvas2DContext,
    x: number,
    y: number,
    items: SkinGridItem[],
    imgMap: Map<string, ImageLike>,
): number => {
    if (items.length === 0) {
        ctx.font = buildCanvasFont(12, 'normal');
        ctx.fillStyle = CANVAS_COLORS.MUTED;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('暂无皮肤数据', x, y + EMPTY_HINT_H / 2);
        ctx.textBaseline = 'top';
        return y + EMPTY_HINT_H;
    }

    items.forEach((item, i) => {
        const col = i % SKIN_GRID_COLS;
        const row = Math.floor(i / SKIN_GRID_COLS);
        const cellX = x + col * (SKIN_CELL_W + SKIN_GRID_GAP);
        const cellY = y + row * (SKIN_CELL_H + SKIN_GRID_GAP);

        // 格子面板
        ctx.fillStyle = CANVAS_COLORS.CARD;
        roundRectPath(ctx, cellX, cellY, SKIN_CELL_W, SKIN_CELL_H, CELL_RADIUS);
        ctx.fill();

        // 皮肤图(缺图画占位框)
        const imgX = cellX + CELL_PAD;
        const imgY = cellY + CELL_PAD;
        const img = imgMap.get(item.value);
        if (img) {
            ctx.drawImage(img as any, imgX, imgY, SKIN_IMG_SIZE, SKIN_IMG_SIZE);
        } else {
            ctx.strokeStyle = CANVAS_COLORS.MUTED;
            roundRectPath(ctx, imgX, imgY, SKIN_IMG_SIZE, SKIN_IMG_SIZE, 6);
            ctx.stroke();
            ctx.font = buildCanvasFont(11, 'normal');
            ctx.fillStyle = CANVAS_COLORS.MUTED;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
                '加载失败',
                imgX + SKIN_IMG_SIZE / 2,
                imgY + SKIN_IMG_SIZE / 2,
            );
        }

        // 名称行: <序号>. <名称>
        const textMaxWidth = SKIN_CELL_W - CELL_PAD * 2;
        ctx.font = buildCanvasFont(11);
        ctx.fillStyle = CANVAS_COLORS.TEXT;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            truncate(ctx, `${item.seq}. ${item.title}`, textMaxWidth),
            imgX,
            cellY + CELL_PAD + SKIN_IMG_SIZE + NAME_ROW_H / 2,
        );

        // ID 行: 皮肤编号(高亮, 供玩家在游戏内/wiki 核对)
        ctx.font = buildCanvasFont(10, 'normal');
        ctx.fillStyle = CANVAS_COLORS.VALUE;
        ctx.fillText(
            truncate(ctx, `ID: ${item.value}`, textMaxWidth),
            imgX,
            cellY + CELL_PAD + SKIN_IMG_SIZE + NAME_ROW_H + ID_ROW_H / 2,
        );
    });

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    return y + measureSkinGridHeight(items.length);
};
