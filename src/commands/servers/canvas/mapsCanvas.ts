import { createCanvas, Canvas2DContext } from '../../../services/canvasBackend';
import { IMapDataItem, OnlineServerItem } from '../types/types';
import {
    getCountColor,
    getServerInfoDisplaySectionText,
    getMapShortName,
    getMapTextInCanvas,
    formatMapDuration,
} from '../utils/utils';
import { BaseCanvas, CanvasSize } from '../../../services/baseCanvas';
import { buildCanvasFont } from '../../../services/canvasFonts';
import {
    roundRectPath,
    drawSegments,
    measureSegmentsWidth,
    truncate,
    TextSegment,
} from '../../../services/canvasHelpers';

// ============================================================================
// 布局常量(沿用 players/overview 的视觉节奏)
// ============================================================================
const PAD = 30;
const TITLE_H = 56;
const SECTION_GAP = 18;

const CARD_GAP = 12; // 地图卡片之间的垂直间距
const CARD_PAD_X = 16;
const CARD_PAD_TOP = 14;
const CARD_PAD_BOTTOM = 14;
const CARD_RADIUS = 12;
const HEADER_H = 30; // 卡片头部行高(序号 + 地图名行)
const HEADER_TO_ROW_GAP = 10; // 头部到服务器行之间的间隙
const SERVER_ROW_H = 28; // 卡片内单个服务器行高
const HEADER_BADGE_GAP = 24; // 卡头地图名与右侧徽章之间的最小间距

const ORDER_FONT_PT = 15; // 序号字号
const ORDER_GAP = 14; // 序号与地图名之间的间距

const FOOTER_H = 40;

// 配色(与 players/overview 家族一致)
const COLOR_BG = '#451a03';
const COLOR_CARD = 'rgba(0, 0, 0, 0.5)';
const COLOR_CARD_IDLE = 'rgba(0, 0, 0, 0.32)'; // 空闲地图卡片(更弱)
const COLOR_ACCENT = '#f48225';
const COLOR_TEXT = '#f8fafc';
const COLOR_MUTED = '#cbb8a3';

const TITLE_TEXT = '地图分布';
const TITLE_GAP = 40; // 标题左侧文字与右侧统计之间的最小间距

interface MapEntry {
    map: IMapDataItem;
    order: string; // 已补零的序号文本(如 "01")
    servers: OnlineServerItem[]; // 该地图下的服务器(按玩家数降序), 空数组为空闲地图
    playersTotal: number;
    capacityTotal: number;
}

/**
 * 地图分布画布 — 有序地图卡片列表(顺序优先, 不拆段):
 *   标题 + 按 mapData 原始顺序逐张地图卡片(序号徽章 + 地图名 + 服务器/玩家徽章, 有服务器则展开服务器行) + 页脚
 * 地图顺序是核心: 既不按玩家数重排, 也不把空闲地图拆到别处。画布宽度按内容自适应。
 */
export class MapsCanvas extends BaseCanvas {
    serverList: OnlineServerItem[];
    mapData: IMapDataItem[];
    fileName: string;
    mapStartedAtMap: Map<string, number | null>;

    // render params data
    renderWidth = 0;
    renderHeight = 0;

    private entries: MapEntry[] = [];
    private orderW = 0; // 序号列宽(取最宽序号)

    constructor(
        serverList: OnlineServerItem[],
        mapData: IMapDataItem[],
        fileName: string,
        mapStartedAtMap: Map<string, number | null> = new Map(),
    ) {
        super();
        this.serverList = serverList;
        this.mapData = mapData;
        this.fileName = fileName;
        this.mapStartedAtMap = mapStartedAtMap;
    }

    private serverKey(server: OnlineServerItem): string {
        return `${server.address}:${server.port}`;
    }

    /** 按 mapData 原始顺序构造条目, 仅在地图内部对服务器按玩家数降序 */
    private buildEntries() {
        const serversByMap = new Map<string, OnlineServerItem[]>();
        this.serverList.forEach((s) => {
            const id = getMapShortName(s.map_id);
            const arr = serversByMap.get(id) ?? [];
            arr.push(s);
            serversByMap.set(id, arr);
        });

        const digits = Math.max(2, String(this.mapData.length).length);

        this.entries = this.mapData.map((m, i) => {
            const servers = (serversByMap.get(m.id) ?? []).sort(
                (a, b) => b.current_players - a.current_players,
            );
            return {
                map: m,
                order: String(i + 1).padStart(digits, '0'),
                servers,
                playersTotal: servers.reduce(
                    (acc, s) => acc + s.current_players,
                    0,
                ),
                capacityTotal: servers.reduce(
                    (acc, s) => acc + s.max_players,
                    0,
                ),
            };
        });
    }

    /** 卡头右侧徽章分段(运行中: 服务器数 · 玩家数; 空闲: 空闲) */
    private buildBadgeSegments(entry: MapEntry): TextSegment[] {
        const labelFont = buildCanvasFont(12, 'normal');
        const valueFont = buildCanvasFont(13);
        if (entry.servers.length === 0) {
            return [{ text: '空闲', color: COLOR_MUTED, font: labelFont }];
        }
        return [
            {
                text: `${entry.servers.length}`,
                color: COLOR_TEXT,
                font: valueFont,
            },
            { text: ' 服务器  ·  ', color: COLOR_MUTED, font: labelFont },
            {
                text: `${entry.playersTotal}`,
                color: getCountColor(entry.playersTotal, entry.capacityTotal),
                font: valueFont,
            },
            { text: ' 玩家', color: COLOR_MUTED, font: labelFont },
        ];
    }

    /** 卡体单个服务器行分段(服务器名 + 人数 + 时长) */
    private buildServerRowSegments(server: OnlineServerItem): TextSegment[] {
        const sec = getServerInfoDisplaySectionText(server);
        const duration = formatMapDuration(
            this.mapStartedAtMap.get(this.serverKey(server)) ?? null,
        );
        return [
            {
                text: sec.serverSection,
                color: COLOR_TEXT,
                font: buildCanvasFont(13),
            },
            {
                text: sec.playersSection,
                color: getCountColor(
                    server.current_players,
                    server.max_players,
                ),
                font: buildCanvasFont(13),
            },
            {
                text: `  ${duration}`,
                color: COLOR_MUTED,
                font: buildCanvasFont(12),
            },
        ];
    }

    /** 标题右侧的概览统计分段 */
    private buildTitleStatSegments(): TextSegment[] {
        const runningCount = this.entries.filter(
            (e) => e.servers.length > 0,
        ).length;
        const labelFont = buildCanvasFont(13, 'normal');
        const valueFont = buildCanvasFont(13);
        return [
            {
                text: `${this.mapData.length}`,
                color: COLOR_TEXT,
                font: valueFont,
            },
            { text: ' 张地图  ·  ', color: COLOR_MUTED, font: labelFont },
            {
                text: `${runningCount}`,
                color: COLOR_TEXT,
                font: valueFont,
            },
            { text: ' 张运行中  ·  ', color: COLOR_MUTED, font: labelFont },
            {
                text: `${this.serverList.length}`,
                color: COLOR_TEXT,
                font: valueFont,
            },
            { text: ' 服务器', color: COLOR_MUTED, font: labelFont },
        ];
    }

    /** 单张地图卡片高度 */
    private cardHeight(entry: MapEntry): number {
        let h = CARD_PAD_TOP + HEADER_H + CARD_PAD_BOTTOM;
        if (entry.servers.length > 0) {
            h += HEADER_TO_ROW_GAP + entry.servers.length * SERVER_ROW_H;
        }
        return h;
    }

    /**
     * 测量阶段: 构造有序条目、确定序号列宽、计算画布宽高。
     */
    private prepare() {
        this.buildEntries();

        const tmp = createCanvas(1, 1);
        const ctx = tmp.getContext('2d');

        // (1) 序号列宽
        ctx.font = buildCanvasFont(ORDER_FONT_PT);
        this.orderW = this.entries.reduce(
            (m, e) => Math.max(m, ctx.measureText(e.order).width),
            0,
        );
        const indent = this.orderW + ORDER_GAP; // 地图名 / 服务器行的左缩进

        // (2) 卡片内容最大宽(卡头 = 序号 + 地图名 + 间距 + 徽章; 服务器行缩进对齐地图名)
        let cardContentW = 0;
        this.entries.forEach((e) => {
            ctx.font = buildCanvasFont(15);
            const mapNameW = ctx.measureText(getMapTextInCanvas(e.map)).width;
            const badgeW = measureSegmentsWidth(ctx, this.buildBadgeSegments(e));
            const headerW = indent + mapNameW + HEADER_BADGE_GAP + badgeW;
            cardContentW = Math.max(cardContentW, headerW);
            e.servers.forEach((s) => {
                cardContentW = Math.max(
                    cardContentW,
                    indent +
                        measureSegmentsWidth(
                            ctx,
                            this.buildServerRowSegments(s),
                        ),
                );
            });
        });

        // (3) footer 宽
        this.renderFooter(ctx);
        ctx.font = buildCanvasFont(10);
        const footerW = this.totalFooter
            ? ctx.measureText(this.totalFooter).width
            : 0;

        // (4) 标题宽
        const titleStatW = measureSegmentsWidth(
            ctx,
            this.buildTitleStatSegments(),
        );
        ctx.font = buildCanvasFont(24);
        const titleW =
            ctx.measureText(TITLE_TEXT).width + TITLE_GAP + titleStatW;

        // (5) 整图宽高
        this.renderWidth = Math.ceil(
            Math.max(
                PAD * 2 + titleW,
                PAD * 2 + cardContentW + CARD_PAD_X * 2,
                20 + footerW,
            ),
        );
        this.renderHeight = this.computeHeight();
    }

    private computeHeight(): number {
        let h = PAD + TITLE_H;
        this.entries.forEach((e, i) => {
            h += this.cardHeight(e);
            if (i < this.entries.length - 1) {
                h += CARD_GAP;
            }
        });
        if (this.entries.length > 0) {
            h += SECTION_GAP;
        }
        h += FOOTER_H;
        return Math.ceil(h);
    }

    private renderTitle(ctx: Canvas2DContext, y: number): number {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = COLOR_TEXT;
        ctx.font = buildCanvasFont(24);
        ctx.fillText(TITLE_TEXT, PAD, y);

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

    private renderMapCards(ctx: Canvas2DContext, y: number): number {
        const cardX = PAD;
        const cardW = this.renderWidth - PAD * 2;
        const indent = this.orderW + ORDER_GAP;

        this.entries.forEach((entry, i) => {
            const cardH = this.cardHeight(entry);
            const isIdle = entry.servers.length === 0;

            // 卡片背景(空闲更弱)
            ctx.fillStyle = isIdle ? COLOR_CARD_IDLE : COLOR_CARD;
            roundRectPath(ctx, cardX, y, cardW, cardH, CARD_RADIUS);
            ctx.fill();

            const headerMidY = y + CARD_PAD_TOP + HEADER_H / 2;
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'left';

            // 序号徽章(accent 强调, 凸显地图顺序)
            ctx.font = buildCanvasFont(ORDER_FONT_PT);
            ctx.fillStyle = COLOR_ACCENT;
            ctx.fillText(entry.order, cardX + CARD_PAD_X, headerMidY);

            // 地图名(超宽截断)
            const badgeSegments = this.buildBadgeSegments(entry);
            const badgeW = measureSegmentsWidth(ctx, badgeSegments);
            const nameX = cardX + CARD_PAD_X + indent;
            const nameMaxW =
                cardW - CARD_PAD_X * 2 - indent - badgeW - HEADER_BADGE_GAP;
            ctx.font = buildCanvasFont(15);
            ctx.fillStyle = isIdle ? COLOR_MUTED : COLOR_TEXT;
            ctx.fillText(
                truncate(ctx, getMapTextInCanvas(entry.map), nameMaxW),
                nameX,
                headerMidY,
            );

            // 右侧徽章
            drawSegments(
                ctx,
                cardX + cardW - CARD_PAD_X,
                headerMidY,
                badgeSegments,
                'right',
            );

            // 卡体: 服务器行(缩进对齐地图名)
            let rowY = y + CARD_PAD_TOP + HEADER_H + HEADER_TO_ROW_GAP;
            entry.servers.forEach((s) => {
                drawSegments(
                    ctx,
                    nameX,
                    rowY + SERVER_ROW_H / 2,
                    this.buildServerRowSegments(s),
                    'left',
                );
                rowY += SERVER_ROW_H;
            });

            y += cardH;
            if (i < this.entries.length - 1) {
                y += CARD_GAP;
            }
        });

        if (this.entries.length > 0) {
            y += SECTION_GAP;
        }
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        return y;
    }

    protected measure(): CanvasSize {
        this.prepare();
        return { width: this.renderWidth, height: this.renderHeight };
    }

    protected getFileName(): string {
        return this.fileName;
    }

    protected getBgColor(): string {
        return COLOR_BG;
    }

    protected paint(ctx: Canvas2DContext): number {
        let y = PAD;
        y = this.renderTitle(ctx, y);
        y = this.renderMapCards(ctx, y);
        return y;
    }
}
