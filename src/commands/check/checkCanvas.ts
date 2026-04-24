import { BaseCanvas } from '../../services/baseCanvas';
import {
    createCanvas,
    type Canvas2DContext,
} from '../../services/canvasBackend';
import { buildCanvasFont } from '../../services/canvasFonts';
import type { CheckLatencyResult, CheckReport } from './types';

const TITLE_FONT = buildCanvasFont(20);
const BODY_FONT = buildCanvasFont(20);
const SMALL_FONT = buildCanvasFont(10);
const LINE_HEIGHT = 40;
const PADDING_X = 20;
const CONTENT_START_X = 20;
const CANVAS_MIN_WIDTH = 820;
const OUTER_PADDING = 10;

const getStatusColor = (item: CheckLatencyResult): string => {
    if (item.status !== 'ok' || typeof item.latencyMs !== 'number') {
        return '#ef4444';
    }
    if (item.latencyMs > 150) {
        return '#ef4444';
    }
    if (item.latencyMs >= 100) {
        return '#f97316';
    }
    return '#22c55e';
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

const ellipsis = (
    context: Canvas2DContext,
    text: string,
    maxWidth: number,
): string => {
    if (context.measureText(text).width <= maxWidth) {
        return text;
    }

    let current = text;
    while (current.length > 1) {
        current = current.slice(0, -1);
        const candidate = `${current}...`;
        if (context.measureText(candidate).width <= maxWidth) {
            return candidate;
        }
    }

    return text;
};

const getDisplayTarget = (item: CheckLatencyResult): string => {
    if (!item.target || item.target === '-') {
        return '';
    }
    return ` (${item.target})`;
};

export class CheckCanvas extends BaseCanvas {
    private renderWidth = CANVAS_MIN_WIDTH;
    private renderHeight = 0;
    private contentLines = 0;
    private maxRectWidth = 0;
    private rectWidth = 0;
    private measureMaxWidth = 0;
    private totalTitle = '';
    private titleStaticSection = '';
    private titleServerCountSection = '';
    private titleReachableStaticSection = '';
    private titleReachableCountSection = '';

    constructor(
        private readonly report: CheckReport,
        private readonly fileName: string,
    ) {
        super();
    }

    private getSummarySectionText() {
        const serverOkCount = this.report.servers.filter(
            (item) => item.status === 'ok',
        ).length;

        return `核心服务: 3 项, 服务器: ${this.report.servers.length} 项, 可达: ${serverOkCount}/${this.report.servers.length}`;
    }

    private buildTitleSections() {
        const serverOkCount = this.report.servers.filter(
            (item) => item.status === 'ok',
        ).length;

        this.titleStaticSection = '网络连通性检查: 核心服务 3 项, 服务器 ';
        this.titleServerCountSection = `${this.report.servers.length} 项`;
        this.titleReachableStaticSection = ', 可达 ';
        this.titleReachableCountSection = `${serverOkCount}/${this.report.servers.length}`;
        this.totalTitle =
            this.titleStaticSection +
            this.titleServerCountSection +
            this.titleReachableStaticSection +
            this.titleReachableCountSection;
    }

    private getRows(): CheckLatencyResult[] {
        return [
            this.report.remoteApi,
            this.report.imageServer,
            this.report.database,
            ...this.report.servers,
        ];
    }

    private measureTitle(context: Canvas2DContext) {
        context.font = TITLE_FONT;
        this.buildTitleSections();
        const titleWidth = context.measureText(this.totalTitle).width + 30;
        if (titleWidth > this.measureMaxWidth) {
            this.measureMaxWidth = titleWidth;
        }
    }

    private measureList() {
        const rows = this.getRows();
        this.contentLines = rows.length + 2;
        this.renderHeight = 120 + this.contentLines * LINE_HEIGHT;
    }

    private renderMeasuredList(context: Canvas2DContext) {
        context.font = BODY_FONT;
        this.maxRectWidth = 0;
        const summaryRows = [
            this.report.remoteApi,
            this.report.imageServer,
            this.report.database,
        ];

        const renderRowWidth = (row: CheckLatencyResult) => {
            const leftText = `${row.label}${getDisplayTarget(row)}`;
            const width =
                22 +
                10 +
                12 +
                context.measureText(leftText).width +
                40 +
                context.measureText(getStatusText(row)).width;
            if (width > this.maxRectWidth) {
                this.maxRectWidth = width;
            }
        };

        this.renderSectionHeader(context, '[核心服务]');
        for (const row of summaryRows) {
            renderRowWidth(row);
            this.renderStartY += LINE_HEIGHT;
        }

        this.renderSectionHeader(context, '[服务器列表 Ping]');
        for (const row of this.report.servers) {
            renderRowWidth(row);
            this.renderStartY += LINE_HEIGHT;
        }
    }

    private measureRender() {
        this.measureMaxWidth = 0;
        this.measureTitle(createCanvas(CANVAS_MIN_WIDTH, 200).getContext('2d'));
        this.measureList();

        const canvas = createCanvas(
            Math.max(CANVAS_MIN_WIDTH, this.measureMaxWidth),
            this.renderHeight,
        );
        const context = canvas.getContext('2d');

        this.renderTitle(context);
        this.renderMeasuredList(context);

        context.font = SMALL_FONT;
        this.renderFooter(context);
        const footerWidth = context.measureText(this.totalFooter).width + 30;

        this.renderWidth = Math.max(
            CANVAS_MIN_WIDTH,
            this.measureMaxWidth,
            this.maxRectWidth + 60,
            footerWidth,
        );
        this.rectWidth = this.maxRectWidth + 20;
    }

    private renderLayout(
        context: Canvas2DContext,
        width: number,
        height: number,
    ) {
        context.fillStyle = '#451a03';
        context.fillRect(0, 0, width, height);
    }

    private renderTitle(context: Canvas2DContext) {
        context.font = TITLE_FONT;
        context.textAlign = 'left';
        context.textBaseline = 'top';
        context.fillStyle = '#fff';

        context.fillText(this.titleStaticSection, 10, 10);
        const titleStaticWidth = context.measureText(
            this.titleStaticSection,
        ).width;

        context.fillStyle = '#fbbf24';
        context.fillText(
            this.titleServerCountSection,
            10 + titleStaticWidth,
            10,
        );

        const titleServerWidth = context.measureText(
            this.titleServerCountSection,
        ).width;

        context.fillStyle = '#fff';
        context.fillText(
            this.titleReachableStaticSection,
            10 + titleStaticWidth + titleServerWidth,
            10,
        );

        const titleReachableStaticWidth = context.measureText(
            this.titleReachableStaticSection,
        ).width;

        const serverOkCount = this.report.servers.filter(
            (item) => item.status === 'ok',
        ).length;
        const reachableColor =
            serverOkCount === this.report.servers.length
                ? '#22c55e'
                : '#f97316';
        context.fillStyle = reachableColor;
        context.fillText(
            this.titleReachableCountSection,
            10 +
                titleStaticWidth +
                titleServerWidth +
                titleReachableStaticWidth,
            10,
        );

        this.renderStartY = 10 + 40 + 10;
    }

    private renderSectionHeader(context: Canvas2DContext, text: string) {
        context.font = BODY_FONT;
        context.fillStyle = '#60a5fa';
        context.fillText(text, CONTENT_START_X, 10 + this.renderStartY);
        this.renderStartY += LINE_HEIGHT;
    }

    private renderRow(context: Canvas2DContext, row: CheckLatencyResult) {
        context.font = BODY_FONT;
        context.textAlign = 'left';
        context.textBaseline = 'top';

        const statusColor = getStatusColor(row);
        const leftText = `${row.label}${getDisplayTarget(row)}`;
        const rightText = getStatusText(row);
        const rightAnchorX = OUTER_PADDING + this.rectWidth - 12;
        const leftMaxWidth = rightAnchorX - (CONTENT_START_X + 22) - 140;

        context.fillStyle = statusColor;
        context.fillRect(CONTENT_START_X, 10 + this.renderStartY + 8, 10, 10);

        context.fillStyle = '#fff';
        context.fillText(
            ellipsis(context, leftText, leftMaxWidth),
            CONTENT_START_X + 22,
            10 + this.renderStartY,
        );

        context.textAlign = 'right';
        context.fillStyle = statusColor;
        context.fillText(rightText, rightAnchorX, 10 + this.renderStartY);
        context.textAlign = 'left';

        this.renderStartY += LINE_HEIGHT;
    }

    private renderRect(context: Canvas2DContext) {
        context.strokeStyle = '#f48225';
        context.rect(
            OUTER_PADDING,
            this.renderStartY + 10,
            this.rectWidth,
            this.contentLines * LINE_HEIGHT + 12,
        );
        context.stroke();
        this.renderStartY += 10;
    }

    render(): string {
        this.record();
        this.measureRender();

        const canvas = createCanvas(this.renderWidth, this.renderHeight);
        const context = canvas.getContext('2d');

        this.renderLayout(context, this.renderWidth, this.renderHeight);
        this.renderBgImg(context, this.renderWidth, this.renderHeight);
        this.renderTitle(context);
        this.renderRect(context);

        this.renderSectionHeader(context, '[核心服务]');
        this.renderRow(context, this.report.remoteApi);
        this.renderRow(context, this.report.imageServer);
        this.renderRow(context, this.report.database);

        this.renderSectionHeader(context, '[服务器列表 Ping]');
        for (const server of this.report.servers) {
            this.renderRow(context, server);
        }

        this.renderFooter(context);

        return this.writeFile(canvas, this.fileName);
    }
}
