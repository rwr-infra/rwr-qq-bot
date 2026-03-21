import { BaseCanvas } from '../../services/baseCanvas';
import { createCanvas, type Canvas2DContext } from '../../services/canvasBackend';
import type { CheckLatencyResult, CheckReport } from './types';

const TITLE_FONT = 'bold 20pt Consolas';
const BODY_FONT = 'bold 20pt Consolas';
const SMALL_FONT = 'bold 10pt Consolas';
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
    private totalTitle = '';

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

    private getRows(): CheckLatencyResult[] {
        return [
            this.report.remoteApi,
            this.report.imageServer,
            this.report.database,
            ...this.report.servers,
        ];
    }

    private measure(context: Canvas2DContext) {
        context.font = TITLE_FONT;
        this.totalTitle = `网络连通性检查: ${this.getSummarySectionText()}`;
        const titleWidth = context.measureText(this.totalTitle).width + 30;

        const rows = this.getRows();
        this.contentLines = rows.length + 2;
        this.maxRectWidth = titleWidth;

        context.font = BODY_FONT;
        for (const row of rows) {
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
        }

        context.font = SMALL_FONT;
        this.renderFooter(context);
        const footerWidth = context.measureText(this.totalFooter).width + 30;

        this.renderWidth = Math.max(
            CANVAS_MIN_WIDTH,
            titleWidth,
            this.maxRectWidth + 60,
            footerWidth,
        );
        this.renderHeight = 120 + this.contentLines * LINE_HEIGHT;
    }

    private renderLayout(context: Canvas2DContext, width: number, height: number) {
        context.fillStyle = '#451a03';
        context.fillRect(0, 0, width, height);
    }

    private renderTitle(context: Canvas2DContext) {
        context.font = TITLE_FONT;
        context.textAlign = 'left';
        context.textBaseline = 'top';
        context.fillStyle = '#fff';
        context.fillText(this.totalTitle, PADDING_X, 10);

        this.renderStartY = 86;
    }

    private renderSectionHeader(context: Canvas2DContext, text: string) {
        context.font = BODY_FONT;
        context.fillStyle = '#60a5fa';
        context.fillText(text, CONTENT_START_X, this.renderStartY);
        this.renderStartY += LINE_HEIGHT;
    }

    private renderRow(context: Canvas2DContext, row: CheckLatencyResult) {
        context.font = BODY_FONT;
        context.textAlign = 'left';
        context.textBaseline = 'top';

        const statusColor = getStatusColor(row);
        const leftText = `${row.label}${getDisplayTarget(row)}`;
        const rightText = getStatusText(row);
        const leftMaxWidth = this.renderWidth - 220;

        context.fillStyle = statusColor;
        context.fillRect(CONTENT_START_X, this.renderStartY + 8, 10, 10);

        context.fillStyle = '#fff';
        context.fillText(
            ellipsis(context, leftText, leftMaxWidth),
            CONTENT_START_X + 22,
            this.renderStartY,
        );

        context.textAlign = 'right';
        context.fillStyle = statusColor;
        context.fillText(
            rightText,
            this.renderWidth - 20,
            this.renderStartY,
        );
        context.textAlign = 'left';

        this.renderStartY += LINE_HEIGHT;
    }

    private renderRect(context: Canvas2DContext) {
        context.strokeStyle = '#f48225';
        context.rect(
            OUTER_PADDING,
            86,
            this.renderWidth - OUTER_PADDING * 2,
            this.contentLines * LINE_HEIGHT + 12,
        );
        context.stroke();
    }

    render(): string {
        this.record();

        const measureCanvas = createCanvas(CANVAS_MIN_WIDTH, 200);
        const measureContext = measureCanvas.getContext('2d');
        this.measure(measureContext);

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
