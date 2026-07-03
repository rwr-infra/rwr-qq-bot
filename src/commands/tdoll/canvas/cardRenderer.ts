import { Canvas2DContext, ImageLike } from '../../../services/canvasBackend';
import { buildCanvasFont } from '../../../services/canvasFonts';
import {
    TextSegment,
    drawSegments,
    roundRectPath,
    truncate,
} from '../../../services/canvasHelpers';
import { CANVAS_COLORS } from '../../../services/canvasTheme';
import { TDollCategoryEnum } from '../types/enums';
import { ITDollDataItem } from '../types/types';
import { splitByQueryMatch } from '../utils/query';
import { AVATAR_RENDER_SIZE, getModAvatarKey } from './assets';

export const CARD_W = 380;
export const CARD_H = 76;
export const CARD_RADIUS = 12;
export const CARD_GAP = 12;

const CARD_PAD = 14;
const AVATAR_RADIUS = 8;
const AVATAR_GAP = 4;
const BADGE_H = 20;
const BADGE_PAD_X = 8;
const MOD_TAG_H = 16;
const MOD_TAG_PAD_X = 6;

/** 查询命中高亮色(与标题 query 段一致) */
export const QUERY_HIGHLIGHT_COLOR = '#22d3ee';

/** 枪种徽章配色: 文字主色 + 同色 16% 透明底 */
export const TDOLL_CLASS_BADGE: Record<
    TDollCategoryEnum,
    { fg: string; bg: string }
> = {
    [TDollCategoryEnum.AR]: { fg: '#f87171', bg: 'rgba(248, 113, 113, 0.16)' },
    [TDollCategoryEnum.SMG]: { fg: '#22d3ee', bg: 'rgba(34, 211, 238, 0.16)' },
    [TDollCategoryEnum.RF]: { fg: '#fcd34d', bg: 'rgba(252, 211, 77, 0.16)' },
    [TDollCategoryEnum.MG]: { fg: '#a78bfa', bg: 'rgba(167, 139, 250, 0.16)' },
    [TDollCategoryEnum.SG]: { fg: '#4ade80', bg: 'rgba(74, 222, 128, 0.16)' },
    [TDollCategoryEnum.HG]: { fg: '#f472b6', bg: 'rgba(244, 114, 182, 0.16)' },
};

export interface TDollCardModel {
    id: string;
    name: string;
    typeText: string;
    tdollClass?: TDollCategoryEnum;
    isMod: boolean;
    /** 用于名称命中高亮的原始查询词 */
    query: string;
}

export const buildCardModel = (
    tdoll: ITDollDataItem,
    query: string,
): TDollCardModel => ({
    id: tdoll.id,
    name: tdoll.nameIngame || '',
    typeText: tdoll.type || '',
    tdollClass: tdoll.tdollClass,
    isMod: tdoll.mod === '1',
    query,
});

/**
 * 列表列数决策: ≤3 项单列, ≥4 项双列(入参已被上游截为 ≤10 → 最多 5 行)。
 */
export const computeCardGridLayout = (
    count: number,
): { cols: 1 | 2; rows: number } => {
    const cols: 1 | 2 = count >= 4 ? 2 : 1;
    return { cols, rows: Math.max(1, Math.ceil(count / cols)) };
};

const drawAvatar = (
    ctx: Canvas2DContext,
    img: ImageLike | undefined,
    x: number,
    y: number,
): void => {
    if (img) {
        ctx.save();
        roundRectPath(ctx, x, y, AVATAR_RENDER_SIZE, AVATAR_RENDER_SIZE, AVATAR_RADIUS);
        ctx.clip();
        ctx.drawImage(img as any, x, y, AVATAR_RENDER_SIZE, AVATAR_RENDER_SIZE);
        ctx.restore();
        return;
    }

    // 缺图占位: 深色圆角块
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    roundRectPath(ctx, x, y, AVATAR_RENDER_SIZE, AVATAR_RENDER_SIZE, AVATAR_RADIUS);
    ctx.fill();
};

const buildNameSegments = (
    ctx: Canvas2DContext,
    model: TDollCardModel,
    maxWidth: number,
): TextSegment[] => {
    const nameFont = buildCanvasFont(15);
    ctx.font = nameFont;
    const displayName = truncate(ctx, model.name, maxWidth);

    const matched = splitByQueryMatch(displayName, model.query);
    if (!matched) {
        return [{ text: displayName, color: CANVAS_COLORS.TEXT, font: nameFont }];
    }

    return [
        { text: matched.before, color: CANVAS_COLORS.TEXT, font: nameFont },
        { text: matched.match, color: QUERY_HIGHLIGHT_COLOR, font: nameFont },
        { text: matched.after, color: CANVAS_COLORS.TEXT, font: nameFont },
    ].filter((s) => s.text.length > 0);
};

/**
 * 在 (x, y) 绘制一张人形卡片, 返回卡片底部 y。
 * width 缺省为 CARD_W(列表网格用), 详情画布可传内容全宽拉伸。
 */
export const drawTDollCard = (
    ctx: Canvas2DContext,
    x: number,
    y: number,
    model: TDollCardModel,
    imgMap: Map<string, ImageLike>,
    width: number = CARD_W,
): number => {
    // 卡片面板
    ctx.fillStyle = CANVAS_COLORS.CARD;
    roundRectPath(ctx, x, y, width, CARD_H, CARD_RADIUS);
    ctx.fill();

    // 左侧头像(mod 版双头像并排)
    const avatarY = y + (CARD_H - AVATAR_RENDER_SIZE) / 2;
    const baseImg = imgMap.get(model.id);
    const modImg = model.isMod
        ? imgMap.get(getModAvatarKey(model.id))
        : undefined;

    drawAvatar(ctx, baseImg, x + CARD_PAD, avatarY);
    let avatarBlockW = AVATAR_RENDER_SIZE;
    if (modImg) {
        drawAvatar(
            ctx,
            modImg,
            x + CARD_PAD + AVATAR_RENDER_SIZE + AVATAR_GAP,
            avatarY,
        );
        avatarBlockW = AVATAR_RENDER_SIZE * 2 + AVATAR_GAP;
    }

    const textX = x + CARD_PAD + avatarBlockW + 12;
    const textMaxRight = x + width - CARD_PAD;

    // mod 角标(右上角)
    let modTagW = 0;
    if (model.isMod) {
        ctx.font = buildCanvasFont(9);
        modTagW = ctx.measureText('MOD').width + MOD_TAG_PAD_X * 2;
        const tagX = x + width - CARD_PAD - modTagW;
        const tagY = y + 8;
        ctx.fillStyle = CANVAS_COLORS.ACCENT;
        roundRectPath(ctx, tagX, tagY, modTagW, MOD_TAG_H, MOD_TAG_H / 2);
        ctx.fill();
        ctx.fillStyle = CANVAS_COLORS.BG;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('MOD', tagX + modTagW / 2, tagY + MOD_TAG_H / 2 + 0.5);
    }

    // 行 1: No.<id> <名称>(命中高亮)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const idFont = buildCanvasFont(12);
    const idPrefixSegments: TextSegment[] = [
        { text: 'No.', color: CANVAS_COLORS.MUTED, font: buildCanvasFont(12, 'normal') },
        { text: model.id, color: CANVAS_COLORS.VALUE, font: idFont },
        { text: '  ', color: CANVAS_COLORS.TEXT, font: idFont },
    ];
    const prefixWidth = idPrefixSegments.reduce((w, s) => {
        ctx.font = s.font;
        return w + ctx.measureText(s.text).width;
    }, 0);
    const nameMaxW = Math.max(
        20,
        textMaxRight - textX - prefixWidth - (model.isMod ? modTagW + 8 : 0),
    );
    const nameSegments = buildNameSegments(ctx, model, nameMaxW);
    drawSegments(ctx, textX, y + 14, [...idPrefixSegments, ...nameSegments]);

    // 行 2: 枪种徽章 + 中文枪种
    const row2CenterY = y + CARD_H - CARD_PAD - BADGE_H / 2;
    let typeTextX = textX;

    const badge = model.tdollClass
        ? TDOLL_CLASS_BADGE[model.tdollClass]
        : undefined;
    if (badge) {
        ctx.font = buildCanvasFont(10);
        const badgeTextW = ctx.measureText(model.tdollClass!).width;
        const badgeW = badgeTextW + BADGE_PAD_X * 2;
        const badgeY = row2CenterY - BADGE_H / 2;

        ctx.fillStyle = badge.bg;
        roundRectPath(ctx, textX, badgeY, badgeW, BADGE_H, BADGE_H / 2);
        ctx.fill();

        ctx.fillStyle = badge.fg;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(model.tdollClass!, textX + badgeW / 2, row2CenterY + 0.5);

        typeTextX = textX + badgeW + 8;
    }

    if (model.typeText) {
        ctx.font = buildCanvasFont(11, 'normal');
        ctx.fillStyle = CANVAS_COLORS.MUTED;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            truncate(ctx, model.typeText, textMaxRight - typeTextX),
            typeTextX,
            row2CenterY + 0.5,
        );
    }

    ctx.textBaseline = 'top';
    return y + CARD_H;
};
