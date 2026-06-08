import { createCanvas, Canvas2DContext } from '../../../services/canvasBackend';
import { IMapDataItem, OnlineServerItem } from '../types/types';
import { getCountColor, formatMapDuration } from '../utils/utils';
import { BaseCanvas } from '../../../services/baseCanvas';
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
const TITLE_H = 64;
const SECTION_GAP = 18;

const KPI_GAP = 16;
const KPI_COUNT = 3;
const KPI_CARD_H = 96;

const CARD_GAP = 12; // 服务器卡片之间的垂直间距
const CARD_PAD_X = 16;
const SERVER_CARD_H = 48; // 单个服务器卡片高度
const SERVER_CARD_RADIUS = 12;
const EMPTY_CARD_H = 64; // 空状态占位卡片高度

const FOOTER_H = 40;

const BASE_WIDTH = 640; // 自适应下限宽

// 配色(与 players/overview 家族一致)
const COLOR_BG = '#451a03';
const COLOR_CARD = 'rgba(0, 0, 0, 0.5)';
const COLOR_ACCENT = '#f48225';
const COLOR_TEXT = '#f8fafc';
const COLOR_MUTED = '#cbb8a3';

const COLOR_STATUS_FULL = '#ef4444';
const COLOR_STATUS_ONLINE = '#22c55e';

const EMPTY_TEXT = '当前没有服务器正在运行此地图';

interface KpiItem {
    label: string;
    value: string;
    valueColor: string;
    sub: string;
}

/**
 * 地图详情画布 — 三段式布局(与 overview 设计语言一致):
 *   标题英雄区(地图名 + id) + KPI 卡片行(运行服务器/在线玩家/满员) + 服务器详情卡片列表 + 页脚
 * 画布宽度按内容自适应(不低于 BASE_WIDTH)。
 */
export class MapDetailCanvas extends BaseCanvas {
    map: IMapDataItem;
    servers: OnlineServerItem[];
    fileName: string;
    mapStartedAtMap: Map<string, number | null>;

    renderWidth = 0;
    renderHeight = 0;

    constructor(
        map: IMapDataItem,
        servers: OnlineServerItem[],
        fileName: string,
        mapStartedAtMap: Map<string, number | null> = new Map(),
    ) {
        super();
        this.map = map;
        this.servers = servers;
        this.fileName = fileName;
        this.mapStartedAtMap = mapStartedAtMap;
    }

    private serverKey(server: OnlineServerItem): string {
        return `${server.address}:${server.port}`;
    }

    private fullCount(): number {
        return this.servers.filter(
            (s) => s.current_players >= s.max_players,
        ).length;
    }

    private buildKpis(): KpiItem[] {
        const playersTotal = this.servers.reduce(
            (acc, s) => acc + s.current_players,
            0,
        );
        const capacityTotal = this.servers.reduce(
            (acc, s) => acc + s.max_players,
            0,
        );
        const fullCount = this.fullCount();
        return [
            {
                label: '运行服务器',
                value: `${this.servers.length}`,
                valueColor: COLOR_TEXT,
                sub: '',
            },
            {
                label: '在线玩家 / 容量',
                value: `${playersTotal}/${capacityTotal}`,
                valueColor: getCountColor(playersTotal, capacityTotal),
                sub: '',
            },
            {
                label: '满员服务器',
                value: `${fullCount}`,
                valueColor: fullCount > 0 ? COLOR_ACCENT : COLOR_TEXT,
                sub: '',
            },
        ];
    }

    /** 服务器卡片分段(服务器名 + 人数 + 状态 + 时长) */
    private buildServerSegments(server: OnlineServerItem): TextSegment[] {
        const isFull = server.current_players >= server.max_players;
        const status = isFull ? '已满' : '在线';
        const duration = formatMapDuration(
            this.mapStartedAtMap.get(this.serverKey(server)) ?? null,
        );
        return [
            {
                text: server.name,
                color: COLOR_TEXT,
                font: buildCanvasFont(14),
            },
            {
                text: `  ${server.current_players}/${server.max_players}`,
                color: getCountColor(
                    server.current_players,
                    server.max_players,
                ),
                font: buildCanvasFont(14),
            },
            {
                text: `  ${status}`,
                color: isFull ? COLOR_STATUS_FULL : COLOR_STATUS_ONLINE,
                font: buildCanvasFont(13),
            },
            {
                text: `  ${duration}`,
                color: COLOR_MUTED,
                font: buildCanvasFont(12),
            },
        ];
    }

    private prepare() {
        const tmp = createCanvas(1, 1);
        const ctx = tmp.getContext('2d');

        // (1) 标题宽
        ctx.font = buildCanvasFont(26);
        const nameW = ctx.measureText(this.map.name).width;
        ctx.font = buildCanvasFont(15, 'normal');
        const idW = ctx.measureText(` (${this.map.id})`).width;
        const titleW = nameW + idW;

        // (2) 服务器行最大宽
        let rowW = 0;
        this.servers.forEach((s) => {
            rowW = Math.max(
                rowW,
                measureSegmentsWidth(ctx, this.buildServerSegments(s)),
            );
        });

        // (3) footer 宽
        this.renderFooter(ctx);
        ctx.font = buildCanvasFont(10);
        const footerW = this.totalFooter
            ? ctx.measureText(this.totalFooter).width
            : 0;

        this.renderWidth = Math.ceil(
            Math.max(
                BASE_WIDTH,
                PAD * 2 + titleW,
                PAD * 2 + rowW + CARD_PAD_X * 2,
                20 + footerW,
            ),
        );
        this.renderHeight = this.computeHeight();
    }

    private computeHeight(): number {
        let h = PAD + TITLE_H + KPI_CARD_H + SECTION_GAP;

        if (this.servers.length === 0) {
            h += EMPTY_CARD_H;
        } else {
            this.servers.forEach((_s, i) => {
                h += SERVER_CARD_H;
                if (i < this.servers.length - 1) {
                    h += CARD_GAP;
                }
            });
        }

        h += SECTION_GAP + FOOTER_H;
        return Math.ceil(h);
    }

    private renderTitle(ctx: Canvas2DContext, y: number): number {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        ctx.font = buildCanvasFont(13, 'normal');
        ctx.fillStyle = COLOR_MUTED;
        ctx.fillText('地图详情', PAD, y);

        // 地图名(大字) + id(弱化)
        const nameY = y + 24;
        ctx.textBaseline = 'middle';
        ctx.font = buildCanvasFont(26);
        ctx.fillStyle = COLOR_TEXT;
        const name = truncate(
            ctx,
            this.map.name,
            this.renderWidth - PAD * 2 - 120,
        );
        ctx.fillText(name, PAD, nameY + 8);
        const nameW = ctx.measureText(name).width;

        ctx.font = buildCanvasFont(15, 'normal');
        ctx.fillStyle = COLOR_MUTED;
        ctx.fillText(` (${this.map.id})`, PAD + nameW + 4, nameY + 10);

        ctx.textBaseline = 'top';
        return y + TITLE_H;
    }

    private renderKpiRow(ctx: Canvas2DContext, y: number): number {
        const kpis = this.buildKpis();
        const contentW = this.renderWidth - PAD * 2;
        const cardW = (contentW - KPI_GAP * (KPI_COUNT - 1)) / KPI_COUNT;

        kpis.forEach((kpi, idx) => {
            const x = PAD + idx * (cardW + KPI_GAP);

            ctx.fillStyle = COLOR_CARD;
            roundRectPath(ctx, x, y, cardW, KPI_CARD_H, 12);
            ctx.fill();

            const innerX = x + 16;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';

            ctx.font = buildCanvasFont(12, 'normal');
            ctx.fillStyle = COLOR_MUTED;
            ctx.fillText(kpi.label, innerX, y + 14);

            ctx.font = buildCanvasFont(24);
            ctx.fillStyle = kpi.valueColor;
            ctx.fillText(
                truncate(ctx, kpi.value, cardW - 32),
                innerX,
                y + 40,
            );
        });

        return y + KPI_CARD_H + SECTION_GAP;
    }

    private renderServerList(ctx: Canvas2DContext, y: number): number {
        const cardX = PAD;
        const cardW = this.renderWidth - PAD * 2;

        if (this.servers.length === 0) {
            ctx.fillStyle = COLOR_CARD;
            roundRectPath(ctx, cardX, y, cardW, EMPTY_CARD_H, SERVER_CARD_RADIUS);
            ctx.fill();

            ctx.font = buildCanvasFont(14, 'normal');
            ctx.fillStyle = COLOR_MUTED;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(EMPTY_TEXT, cardX + cardW / 2, y + EMPTY_CARD_H / 2);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            return y + EMPTY_CARD_H + SECTION_GAP;
        }

        this.servers.forEach((server, i) => {
            ctx.fillStyle = COLOR_CARD;
            roundRectPath(
                ctx,
                cardX,
                y,
                cardW,
                SERVER_CARD_H,
                SERVER_CARD_RADIUS,
            );
            ctx.fill();

            ctx.textBaseline = 'middle';
            drawSegments(
                ctx,
                cardX + CARD_PAD_X,
                y + SERVER_CARD_H / 2,
                this.buildServerSegments(server),
                'left',
            );

            y += SERVER_CARD_H;
            if (i < this.servers.length - 1) {
                y += CARD_GAP;
            }
        });

        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        return y + SECTION_GAP;
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
        y = this.renderKpiRow(ctx, y);
        y = this.renderServerList(ctx, y);

        this.renderStartY = y;
        this.renderFooter(ctx);

        return super.writeFile(canvas, this.fileName);
    }
}
