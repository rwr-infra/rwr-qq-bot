import { createCanvas, Canvas2DContext } from '../../../services/canvasBackend';
import { IUserMatchedServerItem, OnlineServerItem } from '../types/types';
import {
    getServerInfoDisplaySectionText,
    getCountColor,
} from '../utils/utils';
import { BaseCanvas } from '../../../services/baseCanvas';
import { buildCanvasFont } from '../../../services/canvasFonts';
import {
    roundRectPath,
    drawSegments,
    measureSegmentsWidth,
    layoutChips,
    ChipLayout,
    ChipItem,
    TextSegment,
    CHIP_FONT_PT,
    CHIP_PAD_X,
    CHIP_H,
    CHIP_GAP_X,
    CHIP_GAP_Y,
} from '../../../services/canvasHelpers';

// ============================================================================
// 布局常量(沿用 PlayersCanvas / 家族的视觉节奏)
// ============================================================================
const PAD = 30;
const TITLE_H = 56;
const SECTION_GAP = 18;

const CARD_GAP = 14;
const CARD_PAD_X = 16;
const CARD_PAD_TOP = 14;
const CARD_PAD_BOTTOM = 14;
const CARD_RADIUS = 12;
const HEADER_H = 30; // 卡片头部行高(服务器名行)
const HEADER_TO_CHIP_GAP = 10;

const EMPTY_CARD_H = 64; // 空结果态卡片高
const FOOTER_H = 40;

const WRAP_W_MIN = 360; // chip 区目标换行宽下限
const WRAP_W_MAX = 760; // chip 区目标换行宽上限(控制图片不要过宽)

// 配色(与 PlayersCanvas / 家族一致)
const COLOR_BG = '#451a03';
const COLOR_CARD = 'rgba(0, 0, 0, 0.5)';
const COLOR_TEXT = '#f8fafc';
const COLOR_MUTED = '#cbb8a3';

const MAP_TEXT_COLOR = '#fff';
const CHIP_BG = 'rgba(255, 255, 255, 0.08)';
const CHIP_TEXT = '#a5f3fc'; // 命中玩家文本(呼应旧版青色高亮)
const QUERY_HIGHLIGHT = '#a5f3fc'; // 标题中查询词高亮

const TITLE_PREFIX = '查询 ';
const TITLE_SUFFIX = ' 所在服务器';
const TITLE_GAP = 40;

interface ServerGroup {
    server: OnlineServerItem;
    users: string[];
}

/**
 * 玩家位置查询画布 — 按服务器分组卡片(与 PlayersCanvas 设计语言一致):
 *   标题(高亮查询词) + 每个命中服务器一张圆角卡片(服务器信息 + 命中玩家 chip 流式排布) + 页脚
 * 画布宽度按内容自适应。
 */
export class WhereisCanvas extends BaseCanvas {
    matchList: IUserMatchedServerItem[];
    query: string;
    count: number;
    fileName: string;

    // render params data
    renderWidth = 0;
    renderHeight = 0;
    totalFooter = '';
    targetWrapW = WRAP_W_MIN;
    groups: ServerGroup[] = [];
    groupLayouts: ChipLayout[] = [];

    constructor(
        matchList: IUserMatchedServerItem[],
        query: string,
        count: number,
        fileName: string,
    ) {
        super();
        this.matchList = matchList;
        this.query = query;
        this.count = count;
        this.fileName = fileName;
    }

    private get isEmpty(): boolean {
        return this.groups.length === 0;
    }

    /** 按服务器归并命中玩家(保持首次出现顺序) */
    private buildGroups(): ServerGroup[] {
        const map = new Map<string, ServerGroup>();
        const order: string[] = [];
        this.matchList.forEach((m) => {
            const key = `${m.server.address}:${m.server.port}`;
            let group = map.get(key);
            if (!group) {
                group = { server: m.server, users: [] };
                map.set(key, group);
                order.push(key);
            }
            group.users.push(m.user);
        });
        return order.map((k) => map.get(k)!);
    }

    private chipItemsOf(group: ServerGroup): ChipItem[] {
        return group.users.map((name) => ({
            displayName: name,
            isModerator: false,
        }));
    }

    /** 卡片头部分段(服务器名 + 人数 + 地图) */
    private buildHeaderSegments(server: OnlineServerItem): TextSegment[] {
        const sec = getServerInfoDisplaySectionText(server);
        return [
            {
                text: sec.serverSection,
                color: COLOR_TEXT,
                font: buildCanvasFont(15),
            },
            {
                text: sec.playersSection,
                color: getCountColor(
                    server.current_players,
                    server.max_players,
                ),
                font: buildCanvasFont(15),
            },
            {
                text: sec.mapSection,
                color: MAP_TEXT_COLOR,
                font: buildCanvasFont(13),
            },
        ];
    }

    /** 标题左侧分段(高亮查询词) */
    private buildTitleSegments(): TextSegment[] {
        const font = buildCanvasFont(24);
        return [
            { text: TITLE_PREFIX, color: COLOR_TEXT, font },
            { text: `"${this.query}"`, color: QUERY_HIGHLIGHT, font },
            { text: TITLE_SUFFIX, color: COLOR_TEXT, font },
        ];
    }

    /** 标题右侧统计分段 */
    private buildTitleStatSegments(): TextSegment[] {
        const labelFont = buildCanvasFont(13, 'normal');
        const valueFont = buildCanvasFont(13);
        return [
            {
                text: `${this.groups.length}`,
                color: COLOR_TEXT,
                font: valueFont,
            },
            { text: ' 服务器  ·  ', color: COLOR_MUTED, font: labelFont },
            { text: `${this.count}`, color: COLOR_TEXT, font: valueFont },
            { text: ' 结果', color: COLOR_MUTED, font: labelFont },
        ];
    }

    /** 单张卡片高度 */
    private cardHeight(layout: ChipLayout): number {
        const chipAreaH = layout.rows > 0 ? layout.chipAreaH : CHIP_H;
        return (
            CARD_PAD_TOP +
            HEADER_H +
            HEADER_TO_CHIP_GAP +
            chipAreaH +
            CARD_PAD_BOTTOM
        );
    }

    /**
     * 测量阶段: 分组、确定目标换行宽、缓存各组 chip 布局, 计算画布宽高。
     */
    private prepare() {
        this.groups = this.buildGroups();

        const tmp = createCanvas(1, 1);
        const ctx = tmp.getContext('2d');

        // (1) 头行最大宽
        let headerMaxW = 0;
        this.groups.forEach((g) => {
            headerMaxW = Math.max(
                headerMaxW,
                measureSegmentsWidth(ctx, this.buildHeaderSegments(g.server)),
            );
        });

        // (2) 单 chip 最大宽
        ctx.font = buildCanvasFont(CHIP_FONT_PT);
        let chipMaxSingle = 0;
        this.groups.forEach((g) => {
            this.chipItemsOf(g).forEach((it) => {
                const w = ctx.measureText(it.displayName).width + CHIP_PAD_X * 2;
                chipMaxSingle = Math.max(chipMaxSingle, w);
            });
        });

        // (3) 目标换行宽
        this.targetWrapW = Math.max(
            Math.min(Math.max(headerMaxW, WRAP_W_MIN), WRAP_W_MAX),
            chipMaxSingle,
        );

        // (4) 每组 wrap 并缓存
        this.groupLayouts = this.groups.map((g) =>
            layoutChips(ctx, this.chipItemsOf(g), this.targetWrapW),
        );
        const maxChipLineW = this.groupLayouts.reduce(
            (m, l) => Math.max(m, l.maxLineWidth),
            0,
        );

        // (5) footer 宽
        this.renderFooter(ctx);
        ctx.font = buildCanvasFont(10);
        const footerW = this.totalFooter
            ? ctx.measureText(this.totalFooter).width
            : 0;

        // (6) 标题宽
        const titleLeftW = measureSegmentsWidth(ctx, this.buildTitleSegments());
        const titleStatW = measureSegmentsWidth(
            ctx,
            this.buildTitleStatSegments(),
        );
        const titleW = titleLeftW + TITLE_GAP + titleStatW;

        // (7) 空态卡片文本宽
        let emptyW = 0;
        if (this.isEmpty) {
            ctx.font = buildCanvasFont(14);
            emptyW = ctx.measureText(this.emptyText()).width;
        }

        // (8) 整图宽高
        this.renderWidth = Math.ceil(
            Math.max(
                PAD * 2 + titleW,
                PAD * 2 + Math.max(headerMaxW, maxChipLineW) + CARD_PAD_X * 2,
                PAD * 2 + emptyW + CARD_PAD_X * 2,
                20 + footerW,
            ),
        );
        this.renderHeight = this.computeHeight();
    }

    private emptyText(): string {
        return `未查询到 "${this.query}" 的结果`;
    }

    private computeHeight(): number {
        let h = PAD + TITLE_H;

        if (this.isEmpty) {
            h += EMPTY_CARD_H;
        } else {
            this.groupLayouts.forEach((layout, i) => {
                h += this.cardHeight(layout);
                if (i < this.groupLayouts.length - 1) {
                    h += CARD_GAP;
                }
            });
        }

        h += SECTION_GAP;
        h += FOOTER_H;
        return Math.ceil(h);
    }

    private renderTitle(ctx: Canvas2DContext, y: number): number {
        ctx.textBaseline = 'top';
        drawSegments(ctx, PAD, y, this.buildTitleSegments(), 'left');
        drawSegments(
            ctx,
            this.renderWidth - PAD,
            y + 10,
            this.buildTitleStatSegments(),
            'right',
        );
        ctx.textAlign = 'left';
        return y + TITLE_H;
    }

    private renderEmptyCard(ctx: Canvas2DContext, y: number): number {
        const cardX = PAD;
        const cardW = this.renderWidth - PAD * 2;

        ctx.fillStyle = COLOR_CARD;
        roundRectPath(ctx, cardX, y, cardW, EMPTY_CARD_H, CARD_RADIUS);
        ctx.fill();

        ctx.font = buildCanvasFont(14);
        ctx.fillStyle = COLOR_MUTED;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emptyText(), cardX + CARD_PAD_X, y + EMPTY_CARD_H / 2);

        y += EMPTY_CARD_H + SECTION_GAP;
        ctx.textBaseline = 'top';
        return y;
    }

    private renderGroupCards(ctx: Canvas2DContext, y: number): number {
        const cardX = PAD;
        const cardW = this.renderWidth - PAD * 2;

        this.groups.forEach((group, i) => {
            const layout = this.groupLayouts[i];
            const cardH = this.cardHeight(layout);

            // 卡片背景
            ctx.fillStyle = COLOR_CARD;
            roundRectPath(ctx, cardX, y, cardW, cardH, CARD_RADIUS);
            ctx.fill();

            // 头部信息行
            ctx.textBaseline = 'middle';
            drawSegments(
                ctx,
                cardX + CARD_PAD_X,
                y + CARD_PAD_TOP + HEADER_H / 2,
                this.buildHeaderSegments(group.server),
                'left',
            );

            // chip 区
            const chipX0 = cardX + CARD_PAD_X;
            const chipY0 = y + CARD_PAD_TOP + HEADER_H + HEADER_TO_CHIP_GAP;

            layout.lines.forEach((line, rowIdx) => {
                const rowY = chipY0 + rowIdx * (CHIP_H + CHIP_GAP_Y);
                let cx = chipX0;
                line.chips.forEach((chip) => {
                    ctx.fillStyle = CHIP_BG;
                    roundRectPath(ctx, cx, rowY, chip.w, CHIP_H, CHIP_H / 2);
                    ctx.fill();

                    ctx.font = buildCanvasFont(CHIP_FONT_PT);
                    ctx.fillStyle = CHIP_TEXT;
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(chip.text, cx + CHIP_PAD_X, rowY + CHIP_H / 2);

                    cx += chip.w + CHIP_GAP_X;
                });
            });

            y += cardH;
            if (i < this.groups.length - 1) {
                y += CARD_GAP;
            }
        });

        y += SECTION_GAP;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        return y;
    }

    render() {
        this.record();
        this.prepare();

        const canvas = createCanvas(this.renderWidth, this.renderHeight);
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = COLOR_BG;
        ctx.fillRect(0, 0, this.renderWidth, this.renderHeight);
        this.renderBgImg(ctx, this.renderWidth, this.renderHeight);

        let y = PAD;
        y = this.renderTitle(ctx, y);
        y = this.isEmpty
            ? this.renderEmptyCard(ctx, y)
            : this.renderGroupCards(ctx, y);

        this.renderStartY = y;
        this.renderFooter(ctx);

        return super.writeFile(canvas, this.fileName);
    }
}
