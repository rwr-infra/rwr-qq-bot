import { Canvas2DContext } from './canvasBackend';
import { buildCanvasFont } from './canvasFonts';

/**
 * 共享的 canvas 绘制 / 度量辅助。
 * 这些是纯函数(首参均为 ctx), 供 ServerOverviewCanvas / PlayersCanvas 等复用,
 * 避免在各 canvas 类里重复实现圆角、分段文本、截断、自适应字号等逻辑。
 */

// ============================================================================
// 几何 / 文本绘制
// ============================================================================

/** 绘制圆角矩形路径(不填充/描边, 调用方自行 fill()/stroke()) */
export function roundRectPath(
    ctx: Canvas2DContext,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

export interface TextSegment {
    text: string;
    color: string;
    font: string;
}

/**
 * 按段绘制文本(每段可独立着色/字体), 支持左对齐或右对齐整体锚定。
 * 调用方需先设置 textBaseline。
 */
export function drawSegments(
    ctx: Canvas2DContext,
    anchorX: number,
    y: number,
    segments: TextSegment[],
    align: 'left' | 'right' = 'left',
) {
    const total = measureSegmentsWidth(ctx, segments);

    ctx.textAlign = 'left';
    let cx = align === 'right' ? anchorX - total : anchorX;
    for (const s of segments) {
        ctx.font = s.font;
        ctx.fillStyle = s.color;
        ctx.fillText(s.text, cx, y);
        cx += ctx.measureText(s.text).width;
    }
}

/** 计算分段文本的总宽度(逐段设置字体后测量并累加) */
export function measureSegmentsWidth(
    ctx: Canvas2DContext,
    segments: TextSegment[],
): number {
    return segments.reduce((w, s) => {
        ctx.font = s.font;
        return w + ctx.measureText(s.text).width;
    }, 0);
}

/** 超宽文本截断 + 省略号; 在 maxWidth 内则原样返回 */
export function truncate(
    ctx: Canvas2DContext,
    text: string,
    maxWidth: number,
): string {
    if (ctx.measureText(text).width <= maxWidth) {
        return text;
    }
    let str = text;
    while (str.length > 1 && ctx.measureText(str + '…').width > maxWidth) {
        str = str.slice(0, -1);
    }
    return str + '…';
}

/**
 * 在 maxWidth 内绘制完整文本; 若放不下则从 startSize 递减到 minSize 寻找合适字号,
 * 仍放不下则以 minSize 绘制(不截断, 禁止换行)。
 */
export function drawFitText(
    ctx: Canvas2DContext,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    startSize: number,
    minSize: number,
    color: string,
    align: 'left' | 'right' = 'left',
) {
    ctx.textAlign = align;
    for (let size = startSize; size >= minSize; size--) {
        ctx.font = buildCanvasFont(size);
        if (ctx.measureText(text).width <= maxWidth) {
            ctx.fillStyle = color;
            ctx.fillText(text, x, y);
            return;
        }
    }
    ctx.font = buildCanvasFont(minSize);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
}

export interface SparklineAxisLabelOptions {
    x: number; // 折线图左边界
    w: number; // 折线图宽度
    labelY: number; // 刻度文本基线 y(调用方需先设 textBaseline='middle')
    startLabel: string; // 起始刻度(左对齐于 x)
    endLabel: string; // 终止刻度(右对齐于 x+w)
    peakLabel: string | null; // 峰值刻度(居中于 peakX); 为 null 表示峰值在首/尾, 不绘制
    peakX: number; // 峰值点 x 坐标
    mutedColor: string; // 首/尾刻度颜色
    peakColor: string; // 峰值刻度颜色
    font: string; // 刻度字体(三者统一)
    minGap?: number; // 峰值标签与首/尾标签的最小像素间隙, 默认 6
}

/**
 * 在折线图底部绘制「首 / 峰 / 尾」时间刻度。
 * 对峰值标签做像素级防重叠: 量出三者宽度, 若峰值标签盒与首/尾标签盒间距
 * 小于 minGap, 则跳过峰值标签(保留定义时间窗的首尾刻度)。
 * 调用方需先设置 textBaseline。绘制结束后恢复 textAlign='left'。
 */
export function drawSparklineAxisLabels(
    ctx: Canvas2DContext,
    opts: SparklineAxisLabelOptions,
) {
    const {
        x,
        w,
        labelY,
        startLabel,
        endLabel,
        peakLabel,
        peakX,
        mutedColor,
        peakColor,
        font,
        minGap = 6,
    } = opts;

    ctx.font = font;

    // 首(左对齐) / 尾(右对齐)
    ctx.fillStyle = mutedColor;
    ctx.textAlign = 'left';
    ctx.fillText(startLabel, x, labelY);

    ctx.textAlign = 'right';
    ctx.fillText(endLabel, x + w, labelY);

    // 峰值(居中) —— 仅当与首/尾标签不重叠时绘制
    if (peakLabel !== null) {
        const wStart = ctx.measureText(startLabel).width;
        const wEnd = ctx.measureText(endLabel).width;
        const wPeak = ctx.measureText(peakLabel).width;

        const peakLeft = peakX - wPeak / 2;
        const peakRight = peakX + wPeak / 2;
        const startRight = x + wStart;
        const endLeft = x + w - wEnd;

        const clearsStart = peakLeft - startRight >= minGap;
        const clearsEnd = endLeft - peakRight >= minGap;

        if (clearsStart && clearsEnd) {
            ctx.fillStyle = peakColor;
            ctx.textAlign = 'center';
            ctx.fillText(peakLabel, peakX, labelY);
        }
    }

    ctx.textAlign = 'left';
}

// ============================================================================
// Chip(胶囊标签)流式布局 —— PlayersCanvas 使用
// ============================================================================

export const CHIP_FONT_PT = 13; // chip 文本字号
export const CHIP_PAD_X = 12; // chip 左右内边距
export const CHIP_H = 30; // chip 高度(圆角 = CHIP_H/2 → 胶囊形)
export const CHIP_GAP_X = 8; // 同行 chip 间距
export const CHIP_GAP_Y = 8; // chip 行间距
export const CHIP_MAX_W = 320; // 单个 chip 最大宽度(超长则截断)

export interface ChipItem {
    displayName: string; // 已含 moderator badge 的显示名
    isModerator: boolean;
}

export interface LaidChip {
    text: string; // 实际绘制文本(可能被截断)
    w: number; // chip 宽度(含左右内边距)
    isModerator: boolean;
}

export interface ChipLine {
    chips: LaidChip[];
    width: number; // 本行所有 chip + 间距的总宽
}

export interface ChipLayout {
    lines: ChipLine[];
    maxLineWidth: number;
    rows: number;
    chipAreaH: number; // chip 区域总高(不含上下间距); 0 行时为 0
}

/**
 * 把玩家名流式排成多行 chip。第一个 chip 永不因超宽被推到下一行,
 * 因此即使 wrapW 比某个 chip 还窄也不会死循环或产生空行。
 * measure 与 render 必须传入相同的 items 与 wrapW, 以保证布局一致。
 */
export function layoutChips(
    ctx: Canvas2DContext,
    items: ChipItem[],
    wrapW: number,
): ChipLayout {
    ctx.font = buildCanvasFont(CHIP_FONT_PT);
    const maxTextW = CHIP_MAX_W - CHIP_PAD_X * 2;

    const lines: ChipLine[] = [];
    let cur: ChipLine = { chips: [], width: 0 };

    for (const it of items) {
        const text = truncate(ctx, it.displayName, maxTextW);
        const w = ctx.measureText(text).width + CHIP_PAD_X * 2;
        let next = cur.chips.length === 0 ? w : cur.width + CHIP_GAP_X + w;

        if (cur.chips.length > 0 && next > wrapW) {
            lines.push(cur);
            cur = { chips: [], width: 0 };
            next = w;
        }

        cur.width = next;
        cur.chips.push({ text, w, isModerator: it.isModerator });
    }

    if (cur.chips.length > 0) {
        lines.push(cur);
    }

    const rows = lines.length;
    const maxLineWidth = lines.reduce((m, l) => Math.max(m, l.width), 0);
    const chipAreaH = rows > 0 ? rows * CHIP_H + (rows - 1) * CHIP_GAP_Y : 0;

    return { lines, maxLineWidth, rows, chipAreaH };
}
