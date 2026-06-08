import dayjs from 'dayjs';
import { createCanvas, Canvas2DContext } from '../../../services/canvasBackend';
import { BaseCanvas } from '../../../services/baseCanvas';
import { buildCanvasFont } from '../../../services/canvasFonts';
import {
    roundRectPath,
    drawSegments,
    truncate,
    drawFitText,
} from '../../../services/canvasHelpers';
import {
    IAnalysisData,
    IAnalyticsViewData,
    IServerAnalyticsSummary,
} from '../types/types';
import { getCountColor } from '../utils/utils';

// ============================================================================
// 布局常量(与 ServerOverviewCanvas 家族一致)
// ============================================================================
const WIDTH = 880;
const PAD = 30;
const CONTENT_W = WIDTH - PAD * 2;

const TITLE_H = 56;

const KPI_GAP = 16;
const KPI_COUNT = 4;
const KPI_CARD_W = (CONTENT_W - KPI_GAP * (KPI_COUNT - 1)) / KPI_COUNT;
const KPI_CARD_H = 96;

const TREND_GAP = 16;
const TREND_CARD_W = (CONTENT_W - TREND_GAP) / 2;
const TREND_H = 132;

const SECTION_HEADER_H = 40;
const SECTION_GAP = 18;

const RANK_ROW_H = 30;
const RANK_MAX = 15;

const GRID_GAP = 16;
const GRID_COLS = 2;
const GRID_CARD_W = (CONTENT_W - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
const GRID_CARD_H = 118;
const GRID_MAX = 10;

const EMPTY_HINT_H = 30;

const FOOTER_H = 40;

// 配色(暖棕底 + 半透明深色面板, 与 overview 一致)
const COLOR_CARD = 'rgba(0, 0, 0, 0.5)';
const COLOR_BG = '#451a03';
const COLOR_ACCENT = '#f48225';
const COLOR_TEXT = '#f8fafc';
const COLOR_MUTED = '#cbb8a3';
const COLOR_VALUE = '#fcd34d';
const COLOR_TRACK = 'rgba(255, 255, 255, 0.12)';

const TITLE_TEXT = '服务器统计总览';

/**
 * 服务器统计总览画布 — 卡片式多段布局:
 *   段一 KPI 概要: 24h峰值 / 7日峰值 / 当前在线 / 活跃服务器
 *   段二 全局历史趋势: 近24小时 + 近7日 双 sparkline
 *   段三 服务器活跃排行: 按峰值降序的横向条形
 *   段四 各服务器24h趋势: 2 列卡片(迷你 sparkline + 峰值/当前/均值)
 *   段五 页脚
 */
export class AnalyticsCanvas extends BaseCanvas {
    view: IAnalyticsViewData;
    fileName: string;

    renderHeight = 0;

    constructor(view: IAnalyticsViewData, fileName: string) {
        super();
        this.view = view;
        this.fileName = fileName;
    }

    private shownServers(): IServerAnalyticsSummary[] {
        return this.view.servers.slice(0, GRID_MAX);
    }

    private computeHeight(): number {
        let h = PAD + TITLE_H + KPI_CARD_H + SECTION_GAP;

        // 趋势段恒展示(无数据时卡片内显示占位文案)
        h += SECTION_HEADER_H + TREND_H + SECTION_GAP;

        // 活跃排行段
        h += SECTION_HEADER_H;
        if (this.view.servers.length > 0) {
            const rankRows = Math.min(this.view.servers.length, RANK_MAX);
            h += rankRows * RANK_ROW_H + SECTION_GAP;
        } else {
            h += EMPTY_HINT_H + SECTION_GAP;
        }

        // 各服务器趋势卡片段
        h += SECTION_HEADER_H;
        if (this.view.servers.length > 0) {
            const shown = this.shownServers().length;
            const rows = Math.ceil(shown / GRID_COLS);
            h += rows * GRID_CARD_H + (rows - 1) * GRID_GAP + SECTION_GAP;
        } else {
            h += EMPTY_HINT_H + SECTION_GAP;
        }

        h += FOOTER_H;
        return h;
    }

    // ------------------------------------------------------------------
    // 通用绘制辅助
    // ------------------------------------------------------------------
    private kpiValue(v: number | null): string {
        return v === null || v === undefined ? '—' : `${v}`;
    }

    private renderSectionHeader(
        ctx: Canvas2DContext,
        y: number,
        title: string,
        rightNote = '',
    ): number {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        ctx.fillStyle = COLOR_ACCENT;
        ctx.fillRect(PAD, y + 2, 4, 20);

        ctx.font = buildCanvasFont(16);
        ctx.fillStyle = COLOR_TEXT;
        ctx.fillText(title, PAD + 14, y);

        if (rightNote) {
            ctx.textAlign = 'right';
            ctx.font = buildCanvasFont(12, 'normal');
            ctx.fillStyle = COLOR_MUTED;
            ctx.fillText(rightNote, WIDTH - PAD, y + 3);
            ctx.textAlign = 'left';
        }

        return y + SECTION_HEADER_H;
    }

    private renderEmptyHint(ctx: Canvas2DContext, y: number, text: string): number {
        ctx.fillStyle = COLOR_CARD;
        roundRectPath(ctx, PAD, y, CONTENT_W, EMPTY_HINT_H, 8);
        ctx.fill();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = buildCanvasFont(12, 'normal');
        ctx.fillStyle = COLOR_MUTED;
        ctx.fillText(text, WIDTH / 2, y + EMPTY_HINT_H / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        return y + EMPTY_HINT_H + SECTION_GAP;
    }

    /**
     * 在指定矩形内绘制面积折线 sparkline。
     * showLabels 为 true 时绘制首/尾/峰值刻度(用于大趋势卡)。
     */
    private drawSparkline(
        ctx: Canvas2DContext,
        x: number,
        y: number,
        w: number,
        h: number,
        series: IAnalysisData[],
        showLabels: boolean,
    ) {
        const labelH = showLabels ? 16 : 0;
        const chartTop = y;
        const baseline = y + h - labelH;
        const chartH = baseline - chartTop;

        if (series.length === 0) {
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = buildCanvasFont(12, 'normal');
            ctx.fillStyle = COLOR_MUTED;
            ctx.fillText('暂无趋势数据', x + w / 2, chartTop + chartH / 2);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
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

        if (!showLabels) {
            return;
        }

        // 刻度(首 / 峰值 / 尾)
        ctx.font = buildCanvasFont(10, 'normal');
        ctx.fillStyle = COLOR_MUTED;
        ctx.textBaseline = 'middle';
        const labelY = baseline + labelH / 2 + 1;

        ctx.textAlign = 'left';
        ctx.fillText(series[0].date, x, labelY);

        ctx.textAlign = 'right';
        ctx.fillText(series[n - 1].date, x + w, labelY);

        if (peakIdx > 0 && peakIdx < n - 1) {
            ctx.textAlign = 'center';
            ctx.fillStyle = COLOR_VALUE;
            ctx.fillText(peak.date, peak.x, labelY);
        }

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
    }

    // ------------------------------------------------------------------
    // 段一: 标题 + KPI
    // ------------------------------------------------------------------
    private renderTitle(ctx: Canvas2DContext, y: number): number {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = COLOR_TEXT;
        ctx.font = buildCanvasFont(24);
        ctx.fillText(TITLE_TEXT, PAD, y);

        const labelFont = buildCanvasFont(13, 'normal');
        const valueFont = buildCanvasFont(13);
        const updatedText = this.view.lastUpdateTime
            ? `更新于 ${dayjs(this.view.lastUpdateTime).format('HH:mm')}`
            : '暂无采集数据';
        drawSegments(
            ctx,
            WIDTH - PAD,
            y + 10,
            [
                {
                    text: `${this.view.servers.length}`,
                    color: COLOR_TEXT,
                    font: valueFont,
                },
                { text: ' 服务器  ·  ', color: COLOR_MUTED, font: labelFont },
                { text: updatedText, color: COLOR_MUTED, font: labelFont },
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
        roundRectPath(ctx, x, y, KPI_CARD_W, KPI_CARD_H, 12);
        ctx.fill();

        const innerX = x + 16;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        ctx.font = buildCanvasFont(12, 'normal');
        ctx.fillStyle = COLOR_MUTED;
        ctx.fillText(label, innerX, y + 14);

        ctx.font = buildCanvasFont(24);
        ctx.fillStyle = valueColor;
        ctx.fillText(truncate(ctx, value, KPI_CARD_W - 32), innerX, y + 36);

        if (sub) {
            ctx.font = buildCanvasFont(11, 'normal');
            ctx.fillStyle = COLOR_MUTED;
            ctx.fillText(truncate(ctx, sub, KPI_CARD_W - 32), innerX, y + 72);
        }
    }

    private renderKpiRow(ctx: Canvas2DContext, y: number): number {
        const { trend } = this.view;

        this.renderKpiCard(
            ctx,
            0,
            y,
            '24小时峰值',
            this.kpiValue(trend.peak24h),
            COLOR_VALUE,
            '近24h在线最高',
        );
        this.renderKpiCard(
            ctx,
            1,
            y,
            '7日峰值',
            this.kpiValue(trend.peak7d),
            COLOR_VALUE,
            '近7日在线最高',
        );
        this.renderKpiCard(
            ctx,
            2,
            y,
            '当前在线',
            this.kpiValue(trend.latest),
            trend.latest !== null ? COLOR_ACCENT : COLOR_TEXT,
            '最近一次采集',
        );
        this.renderKpiCard(
            ctx,
            3,
            y,
            '活跃服务器',
            `${this.view.activeCount}`,
            COLOR_TEXT,
            `共 ${this.view.servers.length} 个`,
        );

        return y + KPI_CARD_H + SECTION_GAP;
    }

    // ------------------------------------------------------------------
    // 段二: 全局历史趋势(双 sparkline)
    // ------------------------------------------------------------------
    private renderTrendCard(
        ctx: Canvas2DContext,
        x: number,
        y: number,
        title: string,
        peakLabel: string,
        peak: number | null,
        series: IAnalysisData[],
    ) {
        const cardH = TREND_H;
        ctx.fillStyle = COLOR_CARD;
        roundRectPath(ctx, x, y, TREND_CARD_W, cardH, 10);
        ctx.fill();

        const innerX = x + 16;

        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.font = buildCanvasFont(13);
        ctx.fillStyle = COLOR_TEXT;
        ctx.fillText(title, innerX, y + 12);

        if (peak !== null) {
            drawSegments(
                ctx,
                x + TREND_CARD_W - 16,
                y + 12,
                [
                    {
                        text: `${peakLabel} `,
                        color: COLOR_MUTED,
                        font: buildCanvasFont(12, 'normal'),
                    },
                    {
                        text: `${peak}人`,
                        color: COLOR_VALUE,
                        font: buildCanvasFont(13),
                    },
                ],
                'right',
            );
        }

        this.drawSparkline(
            ctx,
            innerX,
            y + 38,
            TREND_CARD_W - 32,
            cardH - 38 - 12,
            series,
            true,
        );

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
    }

    private renderTrendRow(ctx: Canvas2DContext, y: number): number {
        y = this.renderSectionHeader(ctx, y, '全局在线趋势');

        const { trend, series7d } = this.view;
        this.renderTrendCard(
            ctx,
            PAD,
            y,
            '近24小时',
            '峰值',
            trend.peak24h,
            trend.series24h,
        );
        this.renderTrendCard(
            ctx,
            PAD + TREND_CARD_W + TREND_GAP,
            y,
            '近7日',
            '峰值',
            trend.peak7d,
            series7d,
        );

        return y + TREND_H + SECTION_GAP;
    }

    // ------------------------------------------------------------------
    // 段三: 服务器活跃排行
    // ------------------------------------------------------------------
    private renderRankingSection(ctx: Canvas2DContext, y: number): number {
        const total = this.view.servers.length;
        const shown = Math.min(total, RANK_MAX);
        const note = total > shown ? `其余 ${total - shown} 个未展示` : '';

        y = this.renderSectionHeader(ctx, y, '服务器活跃排行', note);

        if (total === 0) {
            return this.renderEmptyHint(
                ctx,
                y,
                '暂无各服务器统计数据(请等待采集任务写入)',
            );
        }

        const rankX = PAD;
        const nameX = PAD + 32;
        const nameMaxW = 226;
        const barX = PAD + 272;
        const valueRight = WIDTH - PAD;
        const barMaxW = valueRight - 46 - barX;

        const maxPeak = Math.max(
            1,
            ...this.view.servers.slice(0, shown).map((s) => s.peak),
        );

        this.view.servers.slice(0, shown).forEach((s, i) => {
            const rowY = y + i * RANK_ROW_H;
            const midY = rowY + RANK_ROW_H / 2;

            ctx.textBaseline = 'middle';

            // 名次
            ctx.textAlign = 'left';
            ctx.font = buildCanvasFont(12);
            ctx.fillStyle = i < 3 ? COLOR_VALUE : COLOR_MUTED;
            ctx.fillText(`${i + 1}`, rankX, midY);

            // 服务器名
            drawFitText(
                ctx,
                s.serverName,
                nameX,
                midY,
                nameMaxW,
                12,
                9,
                COLOR_TEXT,
                'left',
            );

            // 峰值条(轨道 + 填充)
            const barH = 10;
            const barY = midY - barH / 2;
            ctx.fillStyle = COLOR_TRACK;
            roundRectPath(ctx, barX, barY, barMaxW, barH, barH / 2);
            ctx.fill();

            const fillW = Math.max(2, (s.peak / maxPeak) * barMaxW);
            ctx.fillStyle = COLOR_ACCENT;
            roundRectPath(ctx, barX, barY, fillW, barH, barH / 2);
            ctx.fill();

            // 峰值数字
            ctx.textAlign = 'right';
            ctx.font = buildCanvasFont(12);
            ctx.fillStyle = COLOR_VALUE;
            ctx.fillText(`${s.peak}`, valueRight, midY);
        });

        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        return y + shown * RANK_ROW_H + SECTION_GAP;
    }

    // ------------------------------------------------------------------
    // 段四: 各服务器 24h 趋势卡片(2 列网格)
    // ------------------------------------------------------------------
    private renderServerGrid(ctx: Canvas2DContext, y: number): number {
        const total = this.view.servers.length;
        const shown = this.shownServers();
        const note = total > shown.length ? `其余 ${total - shown.length} 个已隐藏` : '';

        y = this.renderSectionHeader(ctx, y, '各服务器24h趋势', note);

        if (total === 0) {
            return this.renderEmptyHint(
                ctx,
                y,
                '暂无各服务器统计数据(请等待采集任务写入)',
            );
        }

        shown.forEach((s, i) => {
            const col = i % GRID_COLS;
            const row = Math.floor(i / GRID_COLS);
            const x = PAD + col * (GRID_CARD_W + GRID_GAP);
            const cardY = y + row * (GRID_CARD_H + GRID_GAP);

            this.renderServerCard(ctx, x, cardY, s);
        });

        const rows = Math.ceil(shown.length / GRID_COLS);
        return y + rows * GRID_CARD_H + (rows - 1) * GRID_GAP + SECTION_GAP;
    }

    private renderServerCard(
        ctx: Canvas2DContext,
        x: number,
        y: number,
        s: IServerAnalyticsSummary,
    ) {
        ctx.fillStyle = COLOR_CARD;
        roundRectPath(ctx, x, y, GRID_CARD_W, GRID_CARD_H, 12);
        ctx.fill();

        const innerX = x + 14;
        const innerW = GRID_CARD_W - 28;

        // 服务器名
        ctx.textBaseline = 'top';
        drawFitText(
            ctx,
            s.serverName,
            innerX,
            y + 12,
            innerW,
            13,
            9,
            COLOR_TEXT,
            'left',
        );

        // 迷你 sparkline
        this.drawSparkline(ctx, innerX, y + 38, innerW, 44, s.series, false);

        // 底部数值: 峰值 / 当前 / 均值
        const labelFont = buildCanvasFont(11, 'normal');
        const valueFont = buildCanvasFont(12);
        ctx.textBaseline = 'middle';
        const statY = y + GRID_CARD_H - 16;
        drawSegments(
            ctx,
            innerX,
            statY,
            [
                { text: '峰值 ', color: COLOR_MUTED, font: labelFont },
                { text: `${s.peak}`, color: COLOR_VALUE, font: valueFont },
                { text: '  当前 ', color: COLOR_MUTED, font: labelFont },
                {
                    text: s.latest === null ? '—' : `${s.latest}`,
                    color: COLOR_ACCENT,
                    font: valueFont,
                },
                { text: '  均值 ', color: COLOR_MUTED, font: labelFont },
                { text: `${s.avg}`, color: COLOR_TEXT, font: valueFont },
            ],
            'left',
        );

        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
    }

    render() {
        this.record();
        this.renderHeight = this.computeHeight();

        const canvas = createCanvas(WIDTH, this.renderHeight);
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = COLOR_BG;
        ctx.fillRect(0, 0, WIDTH, this.renderHeight);
        this.renderBgImg(ctx, WIDTH, this.renderHeight);

        let y = PAD;
        y = this.renderTitle(ctx, y);
        y = this.renderKpiRow(ctx, y);
        y = this.renderTrendRow(ctx, y);
        y = this.renderRankingSection(ctx, y);
        y = this.renderServerGrid(ctx, y);

        this.renderStartY = y;
        this.renderFooter(ctx);

        return super.writeFile(canvas, this.fileName);
    }
}
