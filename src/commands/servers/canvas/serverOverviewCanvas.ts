import { createCanvas, Canvas2DContext } from '../../../services/canvasBackend';
import { BaseCanvas } from '../../../services/baseCanvas';
import { buildCanvasFont } from '../../../services/canvasFonts';
import {
    roundRectPath,
    drawSegments,
    truncate,
    drawFitText,
    TextSegment,
} from '../../../services/canvasHelpers';
import {
    HistoricalServerItem,
    IServerOverviewStats,
    ITrendSummary,
} from '../types/types';
import {
    formatMapDuration,
    getCountColor,
    getServerInfoDisplaySectionText,
} from '../utils/utils';

// ============================================================================
// 布局常量
// ============================================================================
const WIDTH = 880;
const PAD = 30;
const CONTENT_W = WIDTH - PAD * 2;

const TITLE_H = 56;

const KPI_GAP = 16;
const KPI_COUNT = 4;
const KPI_CARD_W = (CONTENT_W - KPI_GAP * (KPI_COUNT - 1)) / KPI_COUNT;
const KPI_CARD_H = 96;

const TREND_H = 128;

const SECTION_HEADER_H = 40;
const DETAIL_COL_HEADER_H = 28;
const DETAIL_ROW_H = 34;
const OFFLINE_ROW_H = 28;
const SECTION_GAP = 18;

const FOOTER_H = 40;

// 配色(与 ServersCanvas/PlayersCanvas 家族一致: #451a03 暖棕底 + OUTPUT_BG_IMG 可叠加)
const COLOR_BG = '#451a03';
const COLOR_CARD = 'rgba(0, 0, 0, 0.5)'; // 半透明深色面板, 叠在底色或背景图上均协调
const COLOR_ACCENT = '#f48225';
const COLOR_TEXT = '#f8fafc';
const COLOR_MUTED = '#cbb8a3'; // 暖色调中性灰
const COLOR_VALUE = '#fcd34d'; // 数值高亮(琥珀金), 用于峰值等

const TITLE_TEXT = '服务器状态总览';

/**
 * 服务器状态总览画布 — 卡片式三段布局:
 *   段一 概览: 标题 + KPI 卡片 + 历史峰值趋势条
 *   段二 服务器详情: 各服务器地图 / 玩家 / Bots / 运行时长
 *   段三 页脚
 */
export class ServerOverviewCanvas extends BaseCanvas {
    stats: IServerOverviewStats;
    trend: ITrendSummary;
    mapStartedAtMap: Map<string, number | null>;
    latencyMap: Map<string, number | null>;
    historicalServers: HistoricalServerItem[];
    fileName: string;

    renderHeight = 0;

    constructor(
        stats: IServerOverviewStats,
        trend: ITrendSummary,
        fileName: string,
        mapStartedAtMap: Map<string, number | null> = new Map(),
        latencyMap: Map<string, number | null> = new Map(),
        historicalServers: HistoricalServerItem[] = [],
    ) {
        super();
        this.stats = stats;
        this.trend = trend;
        this.fileName = fileName;
        this.mapStartedAtMap = mapStartedAtMap;
        this.latencyMap = latencyMap;
        this.historicalServers = historicalServers;
    }

    /** 延迟着色: 低绿 / 中琥珀 / 高红 / 无数据灰 */
    private latencyColor(ms: number | null | undefined): string {
        if (ms === null || ms === undefined) {
            return COLOR_MUTED;
        }
        if (ms < 80) {
            return '#4ade80';
        }
        if (ms < 180) {
            return '#fbbf24';
        }
        return '#f87171';
    }

    private hasTrendStrip(): boolean {
        return (
            this.trend.series24h.length > 0 ||
            this.trend.peak24h !== null ||
            this.trend.peak7d !== null
        );
    }

    /** 计算画布总高度 */
    private computeHeight(): number {
        let h = PAD + TITLE_H + KPI_CARD_H + SECTION_GAP;

        if (this.hasTrendStrip()) {
            h += TREND_H + SECTION_GAP;
        }

        if (this.stats.serverDetail.length > 0) {
            h +=
                SECTION_HEADER_H +
                DETAIL_COL_HEADER_H +
                this.stats.serverDetail.length * DETAIL_ROW_H +
                SECTION_GAP;
        }

        if (this.historicalServers.length > 0) {
            h +=
                SECTION_HEADER_H +
                this.historicalServers.length * OFFLINE_ROW_H +
                SECTION_GAP;
        }

        h += FOOTER_H;
        return h;
    }

    // ------------------------------------------------------------------
    // 绘制辅助
    // ------------------------------------------------------------------
    private roundRectPath(
        ctx: Canvas2DContext,
        x: number,
        y: number,
        w: number,
        h: number,
        r: number,
    ) {
        return roundRectPath(ctx, x, y, w, h, r);
    }

    /**
     * 按段绘制文本(每段可独立着色/字体), 支持左对齐或右对齐整体锚定。
     * 调用方需先设置 textBaseline。
     */
    private drawSegments(
        ctx: Canvas2DContext,
        anchorX: number,
        y: number,
        segments: TextSegment[],
        align: 'left' | 'right' = 'left',
    ) {
        return drawSegments(ctx, anchorX, y, segments, align);
    }

    private truncate(
        ctx: Canvas2DContext,
        text: string,
        maxWidth: number,
    ): string {
        return truncate(ctx, text, maxWidth);
    }

    /**
     * 在 maxWidth 内绘制完整文本; 若放不下则从 startSize 递减到 minSize 寻找合适字号,
     * 仍放不下则以 minSize 绘制(不截断, 禁止换行)。
     */
    private drawFitText(
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
        return drawFitText(
            ctx,
            text,
            x,
            y,
            maxWidth,
            startSize,
            minSize,
            color,
            align,
        );
    }

    // ------------------------------------------------------------------
    // 段一: 概览(标题 + KPI 卡片 + 趋势条)
    // ------------------------------------------------------------------
    private renderTitle(ctx: Canvas2DContext, y: number): number {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = COLOR_TEXT;
        ctx.font = buildCanvasFont(24);
        ctx.fillText(TITLE_TEXT, PAD, y);

        const labelFont = buildCanvasFont(13, 'normal');
        const valueFont = buildCanvasFont(13);
        this.drawSegments(
            ctx,
            WIDTH - PAD,
            y + 10,
            [
                { text: `${this.stats.serverCount}`, color: COLOR_TEXT, font: valueFont },
                { text: ' 服务器  ·  ', color: COLOR_MUTED, font: labelFont },
                {
                    text: `${this.stats.playersTotal}`,
                    color: getCountColor(
                        this.stats.playersTotal,
                        this.stats.capacityTotal,
                    ),
                    font: valueFont,
                },
                { text: ' 玩家在线', color: COLOR_MUTED, font: labelFont },
            ],
            'right',
        );
        ctx.textAlign = 'left';

        return y + TITLE_H;
    }

    private renderKpiCard(
        ctx: Canvas2DContext,
        idx: number,
        y: number,
        label: string,
        value: string,
        valueColor: string,
        sub: string,
    ) {
        const x = PAD + idx * (KPI_CARD_W + KPI_GAP);

        ctx.fillStyle = COLOR_CARD;
        this.roundRectPath(ctx, x, y, KPI_CARD_W, KPI_CARD_H, 12);
        ctx.fill();

        const innerX = x + 16;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        ctx.font = buildCanvasFont(12, 'normal');
        ctx.fillStyle = COLOR_MUTED;
        ctx.fillText(label, innerX, y + 14);

        ctx.font = buildCanvasFont(24);
        ctx.fillStyle = valueColor;
        ctx.fillText(this.truncate(ctx, value, KPI_CARD_W - 32), innerX, y + 36);

        if (sub) {
            ctx.font = buildCanvasFont(11, 'normal');
            ctx.fillStyle = COLOR_MUTED;
            ctx.fillText(
                this.truncate(ctx, sub, KPI_CARD_W - 32),
                innerX,
                y + 72,
            );
        }
    }

    private renderKpiRow(ctx: Canvas2DContext, y: number): number {
        const occupancyPct = `${Math.round(this.stats.occupancyRate * 100)}%`;
        const playersColor = getCountColor(
            this.stats.playersTotal,
            this.stats.capacityTotal,
        );

        this.renderKpiCard(
            ctx,
            0,
            y,
            '在线服务器',
            `${this.stats.serverCount}`,
            COLOR_TEXT,
            `满 ${this.stats.fullCount} · 空 ${this.stats.emptyCount}`,
        );
        this.renderKpiCard(
            ctx,
            1,
            y,
            '在线玩家 / 容量',
            `${this.stats.playersTotal}/${this.stats.capacityTotal}`,
            playersColor,
            `占用 ${occupancyPct}`,
        );
        this.renderKpiCard(
            ctx,
            2,
            y,
            'AI 单位 (Bots)',
            `${this.stats.botsTotal}`,
            COLOR_TEXT,
            '',
        );
        this.renderKpiCard(
            ctx,
            3,
            y,
            '满员服务器',
            `${this.stats.fullCount}`,
            this.stats.fullCount > 0 ? COLOR_ACCENT : COLOR_TEXT,
            `空闲 ${this.stats.emptyCount}`,
        );

        return y + KPI_CARD_H + SECTION_GAP;
    }

    private renderTrendStrip(ctx: Canvas2DContext, y: number): number {
        if (!this.hasTrendStrip()) {
            return y;
        }

        const cardH = TREND_H - 12;
        ctx.fillStyle = COLOR_CARD;
        this.roundRectPath(ctx, PAD, y, CONTENT_W, cardH, 10);
        ctx.fill();

        const innerX = PAD + 16;

        // 标题行: 左侧标题 + 右侧峰值数字
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.font = buildCanvasFont(13);
        ctx.fillStyle = COLOR_TEXT;
        ctx.fillText('在线趋势 · 近24小时', innerX, y + 12);

        const labelFont = buildCanvasFont(12, 'normal');
        const valueFont = buildCanvasFont(13);
        const peakSegments: Array<{
            text: string;
            color: string;
            font: string;
        }> = [];
        if (this.trend.peak24h !== null) {
            peakSegments.push(
                { text: '24h峰值 ', color: COLOR_MUTED, font: labelFont },
                { text: `${this.trend.peak24h}人`, color: COLOR_VALUE, font: valueFont },
            );
        }
        if (this.trend.peak7d !== null) {
            if (peakSegments.length > 0) {
                peakSegments.push({
                    text: '   ·   ',
                    color: COLOR_MUTED,
                    font: labelFont,
                });
            }
            peakSegments.push(
                { text: '7日峰值 ', color: COLOR_MUTED, font: labelFont },
                { text: `${this.trend.peak7d}人`, color: COLOR_VALUE, font: valueFont },
            );
        }
        if (peakSegments.length > 0) {
            this.drawSegments(
                ctx,
                WIDTH - PAD - 16,
                y + 12,
                peakSegments,
                'right',
            );
        }

        // 折线图区域
        this.renderTrendSparkline(
            ctx,
            innerX,
            y + 38,
            CONTENT_W - 32,
            cardH - 38 - 12,
        );

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        return y + TREND_H + SECTION_GAP;
    }

    /** 在指定区域绘制近24小时在线数面积折线图 */
    private renderTrendSparkline(
        ctx: Canvas2DContext,
        x: number,
        y: number,
        w: number,
        h: number,
    ) {
        const series = this.trend.series24h;
        const labelH = 16; // 底部小时刻度
        const chartTop = y;
        const baseline = y + h - labelH;
        const chartH = baseline - chartTop;

        if (series.length === 0) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = buildCanvasFont(12, 'normal');
            ctx.fillStyle = COLOR_MUTED;
            ctx.fillText('暂无趋势数据', x + w / 2, chartTop + chartH / 2);
            return;
        }

        const maxCount = Math.max(1, ...series.map((d) => d.count));
        const n = series.length;
        const points = series.map((d, i) => {
            const px = n === 1 ? x + w / 2 : x + (i / (n - 1)) * w;
            const py = baseline - (d.count / maxCount) * chartH;
            return { x: px, y: py, count: d.count, date: d.date };
        });

        // 基线
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, baseline);
        ctx.lineTo(x + w, baseline);
        ctx.stroke();

        // 面积填充
        ctx.beginPath();
        points.forEach((p, i) =>
            i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
        );
        ctx.lineTo(points[n - 1].x, baseline);
        ctx.lineTo(points[0].x, baseline);
        ctx.closePath();
        ctx.fillStyle = 'rgba(244, 130, 37, 0.18)';
        ctx.fill();

        // 折线
        ctx.beginPath();
        points.forEach((p, i) =>
            i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
        );
        ctx.strokeStyle = COLOR_ACCENT;
        ctx.lineWidth = 2;
        ctx.stroke();

        // 峰值点高亮
        let peakIdx = 0;
        points.forEach((p, i) => {
            if (p.count > points[peakIdx].count) {
                peakIdx = i;
            }
        });
        const peak = points[peakIdx];
        ctx.beginPath();
        ctx.arc(peak.x, peak.y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = COLOR_VALUE;
        ctx.fill();

        // 小时刻度(首 / 峰值 / 尾)
        ctx.font = buildCanvasFont(10, 'normal');
        ctx.fillStyle = COLOR_MUTED;
        ctx.textBaseline = 'middle';
        const labelY = baseline + labelH / 2 + 1;

        ctx.textAlign = 'left';
        ctx.fillText(series[0].date, x, labelY);

        ctx.textAlign = 'right';
        ctx.fillText(series[n - 1].date, x + w, labelY);

        // 峰值小时(避免与首尾重叠)
        if (peakIdx > 0 && peakIdx < n - 1) {
            ctx.textAlign = 'center';
            ctx.fillStyle = COLOR_VALUE;
            ctx.fillText(peak.date, peak.x, labelY);
        }

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
    }

    private renderSectionHeader(
        ctx: Canvas2DContext,
        y: number,
        title: string,
    ): number {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        ctx.fillStyle = COLOR_ACCENT;
        ctx.fillRect(PAD, y + 2, 4, 20);

        ctx.font = buildCanvasFont(16);
        ctx.fillStyle = COLOR_TEXT;
        ctx.fillText(title, PAD + 14, y);

        return y + SECTION_HEADER_H;
    }

    // ------------------------------------------------------------------
    // 段二: 服务器详情(地图 / 玩家 / Bots / 运行时长)
    // ------------------------------------------------------------------
    private renderServerDetail(ctx: Canvas2DContext, y: number): number {
        if (this.stats.serverDetail.length === 0) {
            return y;
        }

        y = this.renderSectionHeader(ctx, y, '服务器详情');

        const nameX = PAD;
        const mapX = PAD + 250;
        const playersRight = PAD + 470;
        const botsRight = PAD + 575;
        const latencyRight = PAD + 700;
        const durationRight = WIDTH - PAD;

        // 列标题 (醒目 + 具有标识性)
        ctx.textBaseline = 'middle';
        ctx.font = buildCanvasFont(11);
        ctx.fillStyle = COLOR_VALUE;
        const headMidY = y + DETAIL_COL_HEADER_H / 2;
        ctx.textAlign = 'left';
        ctx.fillText('服务器', nameX, headMidY);
        ctx.fillText('地图', mapX, headMidY);
        ctx.textAlign = 'right';
        ctx.fillText('玩家', playersRight, headMidY);
        ctx.fillText('Bots', botsRight, headMidY);
        ctx.fillText('延迟', latencyRight, headMidY);
        ctx.fillText('地图时长', durationRight, headMidY);

        const bodyY = y + DETAIL_COL_HEADER_H;

        this.stats.serverDetail.forEach((d, i) => {
            const rowY = bodyY + i * DETAIL_ROW_H;
            const midY = rowY + DETAIL_ROW_H / 2;

            // 斑马纹卡片背景
            if (i % 2 === 0) {
                ctx.fillStyle = COLOR_CARD;
                this.roundRectPath(
                    ctx,
                    PAD - 8,
                    rowY + 2,
                    CONTENT_W + 16,
                    DETAIL_ROW_H - 4,
                    6,
                );
                ctx.fill();
            }

            ctx.textBaseline = 'middle';

            // 服务器名称保持全名, 字号自适应(禁止截断/换行)
            this.drawFitText(
                ctx,
                d.name,
                nameX,
                midY,
                mapX - nameX - 14,
                13,
                9,
                COLOR_TEXT,
                'left',
            );

            ctx.font = buildCanvasFont(12, 'normal');
            ctx.fillStyle = COLOR_ACCENT;
            ctx.fillText(
                this.truncate(ctx, d.mapName, playersRight - mapX - 60),
                mapX,
                midY,
            );

            ctx.textAlign = 'right';
            ctx.font = buildCanvasFont(13);
            ctx.fillStyle = getCountColor(d.players, d.maxPlayers);
            ctx.fillText(`${d.players}/${d.maxPlayers}`, playersRight, midY);

            ctx.fillStyle = d.bots > 0 ? '#67e8f9' : COLOR_MUTED;
            ctx.fillText(`${d.bots}`, botsRight, midY);

            // 延迟
            const latency = this.latencyMap.get(d.serverKey);
            const latencyText =
                latency === null || latency === undefined
                    ? '超时'
                    : `${latency}ms`;
            ctx.fillStyle = this.latencyColor(latency);
            ctx.fillText(latencyText, latencyRight, midY);

            const durationText = formatMapDuration(
                this.mapStartedAtMap.get(d.serverKey) ?? null,
            );
            ctx.fillStyle = '#67e8f9';
            ctx.fillText(durationText, durationRight, midY);
        });

        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        return (
            bodyY + this.stats.serverDetail.length * DETAIL_ROW_H + SECTION_GAP
        );
    }

    // ------------------------------------------------------------------
    // 段二补充: 近期离线服务器(弱化展示)
    // ------------------------------------------------------------------
    private renderOfflineSection(ctx: Canvas2DContext, y: number): number {
        if (this.historicalServers.length === 0) {
            return y;
        }

        y = this.renderSectionHeader(ctx, y, '近5分钟离线服务器');

        const nameX = PAD;
        const mapX = PAD + 250;
        const playersRight = PAD + 470;
        const elapsedRight = WIDTH - PAD;

        ctx.textBaseline = 'middle';

        this.historicalServers.forEach((s, i) => {
            const rowY = y + i * OFFLINE_ROW_H;
            const midY = rowY + OFFLINE_ROW_H / 2;
            const sec = getServerInfoDisplaySectionText(s);

            ctx.textAlign = 'left';
            ctx.font = buildCanvasFont(12, 'normal');
            ctx.fillStyle = COLOR_MUTED;
            ctx.fillText(
                truncate(ctx, s.name, mapX - nameX - 14),
                nameX,
                midY,
            );

            ctx.font = buildCanvasFont(11, 'normal');
            ctx.fillStyle = 'rgba(203, 184, 163, 0.7)';
            ctx.fillText(
                truncate(ctx, sec.mapSection.trim(), playersRight - mapX - 20),
                mapX,
                midY,
            );

            ctx.textAlign = 'right';
            ctx.font = buildCanvasFont(12, 'normal');
            ctx.fillStyle = COLOR_MUTED;
            ctx.fillText(sec.playersSection, playersRight, midY);

            const elapsedMin = Math.ceil((Date.now() - s.lastSeenAt) / 60000);
            ctx.fillStyle = 'rgba(203, 184, 163, 0.6)';
            ctx.fillText(`${elapsedMin}分钟前`, elapsedRight, midY);
        });

        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        return y + this.historicalServers.length * OFFLINE_ROW_H + SECTION_GAP;
    }

    render() {
        this.record();
        this.renderHeight = this.computeHeight();

        const canvas = createCanvas(WIDTH, this.renderHeight);
        const ctx = canvas.getContext('2d');

        // 背景
        ctx.fillStyle = COLOR_BG;
        ctx.fillRect(0, 0, WIDTH, this.renderHeight);
        this.renderBgImg(ctx, WIDTH, this.renderHeight);

        // 段一 概览
        let y = PAD;
        y = this.renderTitle(ctx, y);
        y = this.renderKpiRow(ctx, y);
        y = this.renderTrendStrip(ctx, y);

        // 段二 服务器详情
        y = this.renderServerDetail(ctx, y);
        y = this.renderOfflineSection(ctx, y);

        // 段三 页脚
        this.renderStartY = y;
        this.renderFooter(ctx);

        return super.writeFile(canvas, this.fileName);
    }
}
