import { createCanvas, Canvas2DContext } from '../../../services/canvasBackend';
import { HistoricalServerItem, OnlineServerItem } from '../types/types';
import {
    getServerInfoDisplaySectionText,
    getCountColor,
    getPlayersInServer,
    formatMapDuration,
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

const MODERATOR_BADGE_DEFAULT = '⭐';

// ============================================================================
// 布局常量(沿用 ServerOverviewCanvas 的视觉节奏)
// ============================================================================
const PAD = 30;
const TITLE_H = 56;
const SECTION_GAP = 18;

const CARD_GAP = 14; // 在线服务器卡片之间的垂直间距
const CARD_PAD_X = 16;
const CARD_PAD_TOP = 14;
const CARD_PAD_BOTTOM = 14;
const CARD_RADIUS = 12;
const HEADER_H = 30; // 卡片头部行高(服务器名行)
const HEADER_TO_CHIP_GAP = 10;
const EMPTY_PLACEHOLDER_H = CHIP_H; // 0 玩家时占位行高

const SECTION_HEADER_H = 40;
const OFFLINE_ROW_H = 28;

const FOOTER_H = 40;

const WRAP_W_MIN = 360; // chip 区目标换行宽下限
const WRAP_W_MAX = 760; // chip 区目标换行宽上限(控制图片不要过宽)

// 配色(与 ServerOverviewCanvas / 家族一致)
const COLOR_BG = '#451a03';
const COLOR_CARD = 'rgba(0, 0, 0, 0.5)';
const COLOR_ACCENT = '#f48225';
const COLOR_TEXT = '#f8fafc';
const COLOR_MUTED = '#cbb8a3';
const COLOR_VALUE = '#fcd34d';

// chip 配色
const CHIP_BG_NORMAL = 'rgba(255, 255, 255, 0.08)';
const CHIP_BG_MODERATOR = 'rgba(244, 130, 37, 0.22)';
const CHIP_TEXT_NORMAL = '#a5f3fc'; // 普通玩家文本(沿用旧版青色)
const MAP_TEXT_COLOR = '#fff'; // 地图文本(沿用旧版白色)

const TITLE_TEXT = '在线玩家分布';
const HISTORY_SECTION_TITLE = '近5分钟离线服务器';
const TITLE_GAP = 40; // 标题左侧文字与右侧统计之间的最小间距

/**
 * 玩家分布画布 — 卡片式布局(与 ServerOverviewCanvas 设计语言一致):
 *   标题 + 每个在线服务器一张圆角卡片(头部信息 + 玩家 chip 流式排布) + 近期离线区块 + 页脚
 * 画布宽度按内容自适应。
 */
export class PlayersCanvas extends BaseCanvas {
    serverList: OnlineServerItem[];
    historicalServers: HistoricalServerItem[];
    fileName: string;
    moderators: string[];
    moderatorBadge: string;
    mapStartedAtMap: Map<string, number | null>;

    // render params data
    renderWidth = 0;
    renderHeight = 0;
    targetWrapW = WRAP_W_MIN;
    serverLayouts: ChipLayout[] = [];

    constructor(
        serverList: OnlineServerItem[],
        historicalServers: HistoricalServerItem[],
        fileName: string,
        mapStartedAtMap: Map<string, number | null> = new Map(),
        moderators?: string[],
        moderatorBadge?: string,
    ) {
        super();
        this.serverList = serverList;
        this.historicalServers = historicalServers;
        this.fileName = fileName;
        this.mapStartedAtMap = mapStartedAtMap;
        this.moderators = moderators ?? [];
        this.moderatorBadge = moderatorBadge ?? MODERATOR_BADGE_DEFAULT;
    }

    private isModerator(playerName: string): boolean {
        return this.moderators.some(
            (m) => m.toUpperCase() === playerName.toUpperCase(),
        );
    }

    private getPlayerDisplayName(playerName: string): string {
        return this.isModerator(playerName)
            ? `${playerName} ${this.moderatorBadge}`
            : playerName;
    }

    private chipItemsOf(server: OnlineServerItem): ChipItem[] {
        return getPlayersInServer(server).map((name) => ({
            displayName: this.getPlayerDisplayName(name),
            isModerator: this.isModerator(name),
        }));
    }

    private serverKey(server: OnlineServerItem): string {
        return `${server.address}:${server.port}`;
    }

    /** 组装卡片头部分段(服务器名 + 人数 + 地图 + 时长) */
    private buildHeaderSegments(server: OnlineServerItem): TextSegment[] {
        const sec = getServerInfoDisplaySectionText(server);
        const duration = formatMapDuration(
            this.mapStartedAtMap.get(this.serverKey(server)) ?? null,
        );
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
            {
                text: ` ${duration}`,
                color: COLOR_MUTED,
                font: buildCanvasFont(12),
            },
        ];
    }

    /** 组装离线服务器行的分段(弱化配色) */
    private buildOfflineSegments(server: HistoricalServerItem): TextSegment[] {
        const sec = getServerInfoDisplaySectionText(server);
        const elapsedMin = Math.ceil((Date.now() - server.lastSeenAt) / 60000);
        return [
            {
                text: sec.serverSection,
                color: COLOR_MUTED,
                font: buildCanvasFont(12, 'normal'),
            },
            {
                text: sec.playersSection,
                color: COLOR_MUTED,
                font: buildCanvasFont(12, 'normal'),
            },
            {
                text: sec.mapSection,
                color: 'rgba(203, 184, 163, 0.7)',
                font: buildCanvasFont(11, 'normal'),
            },
            {
                text: `  ${elapsedMin}分钟前`,
                color: 'rgba(203, 184, 163, 0.6)',
                font: buildCanvasFont(11, 'normal'),
            },
        ];
    }

    /** 标题右侧的概览统计分段 */
    private buildTitleStatSegments(): TextSegment[] {
        const totalPlayers = this.serverList.reduce(
            (acc, s) => acc + s.current_players,
            0,
        );
        const totalCapacity = this.serverList.reduce(
            (acc, s) => acc + s.max_players,
            0,
        );
        const labelFont = buildCanvasFont(13, 'normal');
        const valueFont = buildCanvasFont(13);
        return [
            {
                text: `${this.serverList.length}`,
                color: COLOR_TEXT,
                font: valueFont,
            },
            { text: ' 服务器  ·  ', color: COLOR_MUTED, font: labelFont },
            {
                text: `${totalPlayers}`,
                color: getCountColor(totalPlayers, totalCapacity),
                font: valueFont,
            },
            { text: ' 玩家在线', color: COLOR_MUTED, font: labelFont },
        ];
    }

    /** 单张卡片高度 */
    private cardHeight(layout: ChipLayout): number {
        const chipAreaH =
            layout.rows > 0 ? layout.chipAreaH : EMPTY_PLACEHOLDER_H;
        return (
            CARD_PAD_TOP +
            HEADER_H +
            HEADER_TO_CHIP_GAP +
            chipAreaH +
            CARD_PAD_BOTTOM
        );
    }

    /**
     * 测量阶段: 确定唯一的目标换行宽, 缓存各服务器 chip 布局, 计算画布宽高。
     * measure 与 render 复用同一 layout 缓存, 保证两遍布局逐 chip 一致。
     */
    private prepare() {
        const tmp = createCanvas(1, 1);
        const ctx = tmp.getContext('2d');

        // (1) 头行最大宽
        let headerMaxW = 0;
        this.serverList.forEach((s) => {
            headerMaxW = Math.max(
                headerMaxW,
                measureSegmentsWidth(ctx, this.buildHeaderSegments(s)),
            );
        });

        // (2) 单 chip 最大宽(保证最宽 chip 放得下)
        ctx.font = buildCanvasFont(CHIP_FONT_PT);
        let chipMaxSingle = 0;
        this.serverList.forEach((s) => {
            this.chipItemsOf(s).forEach((it) => {
                const w = ctx.measureText(it.displayName).width + CHIP_PAD_X * 2;
                chipMaxSingle = Math.max(chipMaxSingle, w);
            });
        });

        // (3) 目标换行宽
        this.targetWrapW = Math.max(
            Math.min(Math.max(headerMaxW, WRAP_W_MIN), WRAP_W_MAX),
            chipMaxSingle,
        );

        // (4) 每服务器 wrap 并缓存
        this.serverLayouts = this.serverList.map((s) =>
            layoutChips(ctx, this.chipItemsOf(s), this.targetWrapW),
        );
        const maxChipLineW = this.serverLayouts.reduce(
            (m, l) => Math.max(m, l.maxLineWidth),
            0,
        );

        // (5) 估算 footer 宽(renderFooter 写入 this.totalFooter; 禁用时为空)
        this.renderFooter(ctx);
        ctx.font = buildCanvasFont(10);
        const footerW = this.totalFooter
            ? ctx.measureText(this.totalFooter).width
            : 0;

        // (6) 标题宽 / 离线区块宽
        const titleStatW = measureSegmentsWidth(
            ctx,
            this.buildTitleStatSegments(),
        );
        ctx.font = buildCanvasFont(24);
        const titleLeftW = ctx.measureText(TITLE_TEXT).width;
        const titleW = titleLeftW + TITLE_GAP + titleStatW;

        let offlineW = 0;
        if (this.historicalServers.length > 0) {
            ctx.font = buildCanvasFont(16);
            offlineW = ctx.measureText(HISTORY_SECTION_TITLE).width + 14;
            this.historicalServers.forEach((s) => {
                offlineW = Math.max(
                    offlineW,
                    measureSegmentsWidth(ctx, this.buildOfflineSegments(s)),
                );
            });
        }

        // (7) 整图宽高
        this.renderWidth = Math.ceil(
            Math.max(
                PAD * 2 + titleW,
                PAD * 2 + Math.max(headerMaxW, maxChipLineW) + CARD_PAD_X * 2,
                PAD * 2 + offlineW,
                20 + footerW,
            ),
        );
        this.renderHeight = this.computeHeight();
    }

    private computeHeight(): number {
        let h = PAD + TITLE_H;

        this.serverLayouts.forEach((layout, i) => {
            h += this.cardHeight(layout);
            if (i < this.serverLayouts.length - 1) {
                h += CARD_GAP;
            }
        });

        if (this.serverList.length > 0) {
            h += SECTION_GAP;
        }

        if (this.historicalServers.length > 0) {
            h +=
                SECTION_HEADER_H +
                this.historicalServers.length * OFFLINE_ROW_H +
                SECTION_GAP;
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

    private renderServerCards(ctx: Canvas2DContext, y: number): number {
        const cardX = PAD;
        const cardW = this.renderWidth - PAD * 2;

        this.serverList.forEach((server, i) => {
            const layout = this.serverLayouts[i];
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
                this.buildHeaderSegments(server),
                'left',
            );

            // chip 区
            const chipX0 = cardX + CARD_PAD_X;
            const chipY0 = y + CARD_PAD_TOP + HEADER_H + HEADER_TO_CHIP_GAP;

            if (layout.rows === 0) {
                ctx.font = buildCanvasFont(12, 'normal');
                ctx.fillStyle = COLOR_MUTED;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText('暂无玩家', chipX0, chipY0 + CHIP_H / 2);
            } else {
                layout.lines.forEach((line, rowIdx) => {
                    const rowY = chipY0 + rowIdx * (CHIP_H + CHIP_GAP_Y);
                    let cx = chipX0;
                    line.chips.forEach((chip) => {
                        ctx.fillStyle = chip.isModerator
                            ? CHIP_BG_MODERATOR
                            : CHIP_BG_NORMAL;
                        roundRectPath(ctx, cx, rowY, chip.w, CHIP_H, CHIP_H / 2);
                        ctx.fill();

                        ctx.font = buildCanvasFont(CHIP_FONT_PT);
                        ctx.fillStyle = chip.isModerator
                            ? COLOR_VALUE
                            : CHIP_TEXT_NORMAL;
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(
                            chip.text,
                            cx + CHIP_PAD_X,
                            rowY + CHIP_H / 2,
                        );

                        cx += chip.w + CHIP_GAP_X;
                    });
                });
            }

            y += cardH;
            if (i < this.serverList.length - 1) {
                y += CARD_GAP;
            }
        });

        if (this.serverList.length > 0) {
            y += SECTION_GAP;
        }
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        return y;
    }

    private renderOfflineSection(ctx: Canvas2DContext, y: number): number {
        if (this.historicalServers.length === 0) {
            return y;
        }

        // 分段标题(accent 竖条 + 标题)
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = COLOR_ACCENT;
        ctx.fillRect(PAD, y + 2, 4, 20);
        ctx.font = buildCanvasFont(16);
        ctx.fillStyle = COLOR_TEXT;
        ctx.fillText(HISTORY_SECTION_TITLE, PAD + 14, y);
        y += SECTION_HEADER_H;

        this.historicalServers.forEach((server) => {
            const midY = y + OFFLINE_ROW_H / 2;
            ctx.textBaseline = 'middle';
            drawSegments(
                ctx,
                PAD,
                midY,
                this.buildOfflineSegments(server),
                'left',
            );
            y += OFFLINE_ROW_H;
        });

        y += SECTION_GAP;
        ctx.textBaseline = 'top';
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
        y = this.renderServerCards(ctx, y);
        y = this.renderOfflineSection(ctx, y);

        this.renderStartY = y;
        this.renderFooter(ctx);

        return super.writeFile(canvas, this.fileName);
    }
}
