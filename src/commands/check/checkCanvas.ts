import { BaseCanvas, CanvasSize } from '../../services/baseCanvas';
import {
    createCanvas,
    type Canvas2DContext,
} from '../../services/canvasBackend';
import { buildCanvasFont } from '../../services/canvasFonts';
import {
    roundRectPath,
    drawSegments,
    measureSegmentsWidth,
    truncate,
    TextSegment,
} from '../../services/canvasHelpers';
import type { CheckLatencyResult, CheckReport } from './types';

// ============================================================================
// 布局常量(沿用 ServersCanvas / 家族的视觉节奏)
// ============================================================================
const PAD = 30;
const TITLE_H = 56;
const SECTION_GAP = 18;

const CARD_PAD_X = 16;
const CARD_PAD_TOP = 14;
const CARD_PAD_BOTTOM = 14;
const CARD_RADIUS = 12;

const SECTION_HEADER_H = 40;
const ROW_H = 30; // 面板内每行行高
const DOT_R = 5; // 状态点半径
const DOT_GAP = 12; // 状态点与文本间距
const RIGHT_GAP = 40; // 左文本与右值之间的最小间距

const FOOTER_H = 40;

// 配色(与 ServerOverviewCanvas / 家族一致)
const COLOR_BG = '#451a03';
const COLOR_CARD = 'rgba(0, 0, 0, 0.5)';
const COLOR_ACCENT = '#f48225';
const COLOR_TEXT = '#f8fafc';
const COLOR_MUTED = '#cbb8a3';

// 延迟/状态着色(与 serverOverviewCanvas.latencyColor 一致)
const COLOR_LATENCY_LOW = '#4ade80';
const COLOR_LATENCY_MID = '#fbbf24';
const COLOR_LATENCY_HIGH = '#f87171';
const COLOR_OK_ALL = '#22c55e'; // 标题统计: 全部可达
const COLOR_PARTIAL = '#f97316'; // 标题统计: 部分可达

const TITLE_TEXT = '网络连通性检查';
const CORE_SECTION_TITLE = '核心服务';
const SERVERS_SECTION_TITLE = '服务器列表 Ping';
const TITLE_GAP = 40;

/** 状态/延迟着色: ok 且低绿/中琥珀/高红; 非 ok skipped 弱化, 其余红 */
const getStatusColor = (item: CheckLatencyResult): string => {
    if (item.status === 'skipped') {
        return COLOR_MUTED;
    }
    if (item.status !== 'ok' || typeof item.latencyMs !== 'number') {
        return COLOR_LATENCY_HIGH;
    }
    if (item.latencyMs < 80) {
        return COLOR_LATENCY_LOW;
    }
    if (item.latencyMs < 180) {
        return COLOR_LATENCY_MID;
    }
    return COLOR_LATENCY_HIGH;
};

const getStatusText = (item: CheckLatencyResult): string => {
    if (item.status === 'ok' && typeof item.latencyMs === 'number') {
        return `${item.latencyMs} ms`;
    }
    if (item.message) {
        return item.message;
    }
    switch (item.status) {
        case 'skipped':
            return 'skipped';
        case 'error':
            return 'failed';
        default:
            return '-';
    }
};

const getDisplayTarget = (item: CheckLatencyResult): string => {
    if (!item.target || item.target === '-') {
        return '';
    }
    return ` (${item.target})`;
};

interface PanelSection {
    title: string;
    rows: CheckLatencyResult[];
    /** rows 为空时面板内的占位文本(无则不显示占位) */
    emptyPlaceholder?: string;
}

/**
 * 网络连通性检查画布 — 分节面板卡片布局(与家族设计语言一致):
 *   标题(右侧可达统计) + 核心服务面板 + 服务器列表 Ping 面板 + 页脚
 * 画布宽度按内容自适应。
 */
export class CheckCanvas extends BaseCanvas {
    private renderWidth = 0;
    private renderHeight = 0;
    totalFooter = '';

    constructor(
        private readonly report: CheckReport,
        private readonly fileName: string,
    ) {
        super();
    }

    private coreRows(): CheckLatencyResult[] {
        return [
            this.report.remoteApi,
            this.report.aiAgent,
            this.report.imageServer,
            this.report.database,
        ];
    }

    private sections(): PanelSection[] {
        return [
            { title: CORE_SECTION_TITLE, rows: this.coreRows() },
            {
                title: SERVERS_SECTION_TITLE,
                rows: this.report.servers,
                emptyPlaceholder: '暂无服务器',
            },
        ];
    }

    /** 行左侧文本分段(label + target) */
    private buildRowLeftSegments(row: CheckLatencyResult): TextSegment[] {
        return [
            { text: row.label, color: COLOR_TEXT, font: buildCanvasFont(14) },
            {
                text: getDisplayTarget(row),
                color: COLOR_MUTED,
                font: buildCanvasFont(13, 'normal'),
            },
        ];
    }

    /** 标题右侧的可达统计分段 */
    private buildTitleStatSegments(): TextSegment[] {
        const coreOk = this.coreRows().filter((r) => r.status === 'ok').length;
        const serverOk = this.report.servers.filter(
            (r) => r.status === 'ok',
        ).length;
        const serverTotal = this.report.servers.length;

        const labelFont = buildCanvasFont(13, 'normal');
        const valueFont = buildCanvasFont(13);
        const coreColor = coreOk === 4 ? COLOR_OK_ALL : COLOR_PARTIAL;
        const serverColor =
            serverTotal > 0 && serverOk === serverTotal
                ? COLOR_OK_ALL
                : COLOR_PARTIAL;

        return [
            { text: '核心 ', color: COLOR_MUTED, font: labelFont },
            { text: `${coreOk}/4`, color: coreColor, font: valueFont },
            { text: '  ·  服务器 ', color: COLOR_MUTED, font: labelFont },
            {
                text: `${serverOk}/${serverTotal}`,
                color: serverColor,
                font: valueFont,
            },
            { text: ' 可达', color: COLOR_MUTED, font: labelFont },
        ];
    }

    private panelHeight(section: PanelSection): number {
        const rowCount = Math.max(
            section.rows.length,
            section.emptyPlaceholder ? 1 : 0,
        );
        return CARD_PAD_TOP + rowCount * ROW_H + CARD_PAD_BOTTOM;
    }

    /**
     * 测量阶段: 计算画布宽高。
     */
    private prepare() {
        const tmp = createCanvas(1, 1);
        const ctx = tmp.getContext('2d');

        // (1) 行内容最大宽(点 + 左文本 + 间距 + 右值)
        let rowContentW = 0;
        const allRows = [...this.coreRows(), ...this.report.servers];
        allRows.forEach((row) => {
            const leftW = measureSegmentsWidth(
                ctx,
                this.buildRowLeftSegments(row),
            );
            ctx.font = buildCanvasFont(13);
            const rightW = ctx.measureText(getStatusText(row)).width;
            rowContentW = Math.max(
                rowContentW,
                DOT_R * 2 + DOT_GAP + leftW + RIGHT_GAP + rightW,
            );
        });

        // (2) footer 宽
        this.renderFooter(ctx);
        ctx.font = buildCanvasFont(10);
        const footerW = this.totalFooter
            ? ctx.measureText(this.totalFooter).width
            : 0;

        // (3) 标题宽
        const titleStatW = measureSegmentsWidth(
            ctx,
            this.buildTitleStatSegments(),
        );
        ctx.font = buildCanvasFont(24);
        const titleLeftW = ctx.measureText(TITLE_TEXT).width;
        const titleW = titleLeftW + TITLE_GAP + titleStatW;

        // (4) 节标题宽
        let sectionTitleW = 0;
        ctx.font = buildCanvasFont(16);
        this.sections().forEach((s) => {
            sectionTitleW = Math.max(
                sectionTitleW,
                ctx.measureText(s.title).width + 14,
            );
        });

        // (5) 整图宽高
        this.renderWidth = Math.ceil(
            Math.max(
                PAD * 2 + titleW,
                PAD * 2 + rowContentW + CARD_PAD_X * 2,
                PAD * 2 + sectionTitleW,
                20 + footerW,
            ),
        );
        this.renderHeight = this.computeHeight();
    }

    private computeHeight(): number {
        let h = PAD + TITLE_H;

        this.sections().forEach((section) => {
            h += SECTION_HEADER_H + this.panelHeight(section) + SECTION_GAP;
        });

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

    private renderSection(
        ctx: Canvas2DContext,
        section: PanelSection,
        y: number,
    ): number {
        // 节标题(accent 竖条 + 标题)
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = COLOR_ACCENT;
        ctx.fillRect(PAD, y + 2, 4, 20);
        ctx.font = buildCanvasFont(16);
        ctx.fillStyle = COLOR_TEXT;
        ctx.fillText(section.title, PAD + 14, y);
        y += SECTION_HEADER_H;

        // 面板卡片
        const cardX = PAD;
        const cardW = this.renderWidth - PAD * 2;
        const cardH = this.panelHeight(section);
        ctx.fillStyle = COLOR_CARD;
        roundRectPath(ctx, cardX, y, cardW, cardH, CARD_RADIUS);
        ctx.fill();

        const rowX = cardX + CARD_PAD_X;
        const rightAnchorX = cardX + cardW - CARD_PAD_X;
        let rowY = y + CARD_PAD_TOP;

        if (section.rows.length === 0 && section.emptyPlaceholder) {
            ctx.font = buildCanvasFont(13, 'normal');
            ctx.fillStyle = COLOR_MUTED;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(section.emptyPlaceholder, rowX, rowY + ROW_H / 2);
        } else {
            section.rows.forEach((row) => {
                const midY = rowY + ROW_H / 2;
                const statusColor = getStatusColor(row);

                // 状态点
                ctx.beginPath();
                ctx.arc(rowX + DOT_R, midY, DOT_R, 0, Math.PI * 2);
                ctx.fillStyle = statusColor;
                ctx.fill();

                // 右值(先测量, 为左文本留出截断宽度)
                const rightText = getStatusText(row);
                ctx.font = buildCanvasFont(13);
                const rightW = ctx.measureText(rightText).width;

                // 左文本(label + target, 截断)
                const leftX = rowX + DOT_R * 2 + DOT_GAP;
                const leftMaxW = rightAnchorX - rightW - RIGHT_GAP - leftX;
                ctx.textBaseline = 'middle';
                this.drawLeftSegmentsTruncated(
                    ctx,
                    row,
                    leftX,
                    midY,
                    Math.max(leftMaxW, 40),
                );

                // 右值
                ctx.font = buildCanvasFont(13);
                ctx.fillStyle = statusColor;
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.fillText(rightText, rightAnchorX, midY);
                ctx.textAlign = 'left';

                rowY += ROW_H;
            });
        }

        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        return y + cardH + SECTION_GAP;
    }

    /** 绘制 label + target, 整体超过 maxWidth 时截断 target(或 label) */
    private drawLeftSegmentsTruncated(
        ctx: Canvas2DContext,
        row: CheckLatencyResult,
        x: number,
        midY: number,
        maxWidth: number,
    ) {
        const labelFont = buildCanvasFont(14);
        const targetFont = buildCanvasFont(13, 'normal');
        const target = getDisplayTarget(row);

        ctx.font = labelFont;
        const labelW = ctx.measureText(row.label).width;

        ctx.textAlign = 'left';

        // label 自身已超宽: 截断 label, 不画 target
        if (labelW >= maxWidth) {
            ctx.font = labelFont;
            ctx.fillStyle = COLOR_TEXT;
            ctx.fillText(truncate(ctx, row.label, maxWidth), x, midY);
            return;
        }

        ctx.font = labelFont;
        ctx.fillStyle = COLOR_TEXT;
        ctx.fillText(row.label, x, midY);

        if (target) {
            ctx.font = targetFont;
            ctx.fillStyle = COLOR_MUTED;
            ctx.fillText(
                truncate(ctx, target, maxWidth - labelW),
                x + labelW,
                midY,
            );
        }
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
        this.sections().forEach((section) => {
            y = this.renderSection(ctx, section, y);
        });
        return y;
    }
}
