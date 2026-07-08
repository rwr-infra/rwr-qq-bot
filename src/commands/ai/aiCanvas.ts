import { BaseCanvas, CanvasSize } from '../../services/baseCanvas';
import { createCanvas, type Canvas2DContext } from '../../services/canvasBackend';
import { buildCanvasFont } from '../../services/canvasFonts';

const CONTENT_FONT = buildCanvasFont(16);
const TITLE_FONT = buildCanvasFont(20);
const SUBTITLE_FONT = buildCanvasFont(14);
const SECTION_FONT = buildCanvasFont(16);
const LINE_HEIGHT = 28;
const PADDING_X = 20;
const OUTER_PADDING = 10;
const CANVAS_WIDTH = 800;
const CONTENT_START_X = 20;
const MAX_CONTENT_WIDTH = CANVAS_WIDTH - CONTENT_START_X * 2 - OUTER_PADDING * 2;

export class AiCanvas extends BaseCanvas {
    private renderHeight = 0;
    private wrappedLines: string[] = [];
    private rectWidth = 0;
    private rectHeight = 0;
    private contentStartY = 0;

    constructor(
        private readonly query: string,
        private readonly content: string,
        private readonly fileName: string,
    ) {
        super();
    }

    private wrapText(context: Canvas2DContext, text: string, maxWidth: number): string[] {
        const lines: string[] = [];
        const paragraphs = text.split('\n');

        for (const paragraph of paragraphs) {
            let currentLine = '';
            for (let i = 0; i < paragraph.length; i++) {
                const char = paragraph[i];
                const testLine = currentLine + char;
                const metrics = context.measureText(testLine);
                if (metrics.width > maxWidth && currentLine.length > 0) {
                    lines.push(currentLine);
                    currentLine = char;
                } else {
                    currentLine = testLine;
                }
            }
            if (currentLine.length > 0) {
                lines.push(currentLine);
            }
        }

        return lines;
    }

    private ellipsis(context: Canvas2DContext, text: string, maxWidth: number): string {
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
    }

    private measureRender() {
        const canvas = createCanvas(CANVAS_WIDTH, 200);
        const context = canvas.getContext('2d');
        context.font = CONTENT_FONT;

        this.wrappedLines = this.wrapText(context, this.content, MAX_CONTENT_WIDTH);

        this.rectWidth = CANVAS_WIDTH - OUTER_PADDING * 2;
        this.contentStartY = 10 + 40 + 30 + 10;
        this.rectHeight = 10 + LINE_HEIGHT + this.wrappedLines.length * LINE_HEIGHT + 10;

        const titleHeight = 50;
        const subtitleHeight = 30;
        const footerHeight = 40;
        this.renderHeight = titleHeight + subtitleHeight + this.rectHeight + footerHeight + OUTER_PADDING * 3;
    }

    private renderTitle(context: Canvas2DContext) {
        context.font = TITLE_FONT;
        context.textAlign = 'left';
        context.textBaseline = 'top';
        context.fillStyle = '#fff';
        context.fillText('AI 智能问答', CONTENT_START_X, 10);
        this.renderStartY = 10 + 40;
    }

    private renderSubtitle(context: Canvas2DContext) {
        context.font = SUBTITLE_FONT;
        context.textAlign = 'left';
        context.textBaseline = 'top';
        context.fillStyle = '#fbbf24';
        const label = '用户输入: ';
        const labelWidth = context.measureText(label).width;
        context.fillText(label, CONTENT_START_X, this.renderStartY);

        context.fillStyle = '#fff';
        const maxQueryWidth = CANVAS_WIDTH - CONTENT_START_X - labelWidth - 20;
        const displayQuery = this.ellipsis(context, this.query, maxQueryWidth);
        context.fillText(displayQuery, CONTENT_START_X + labelWidth, this.renderStartY);

        this.renderStartY += 30;
    }

    private renderRect(context: Canvas2DContext) {
        context.strokeStyle = '#f48225';
        context.rect(
            OUTER_PADDING,
            this.renderStartY,
            this.rectWidth,
            this.rectHeight,
        );
        context.stroke();
        this.renderStartY += 10;
    }

    private renderSectionHeader(context: Canvas2DContext, text: string) {
        context.font = SECTION_FONT;
        context.textAlign = 'left';
        context.textBaseline = 'top';
        context.fillStyle = '#60a5fa';
        context.fillText(text, CONTENT_START_X, this.renderStartY);
        this.renderStartY += LINE_HEIGHT;
    }

    private renderContent(context: Canvas2DContext) {
        context.font = CONTENT_FONT;
        context.textAlign = 'left';
        context.textBaseline = 'top';
        context.fillStyle = '#fff';

        for (const line of this.wrappedLines) {
            context.fillText(line, CONTENT_START_X, this.renderStartY);
            this.renderStartY += LINE_HEIGHT;
        }
    }

    protected measure(): CanvasSize {
        this.measureRender();
        return { width: CANVAS_WIDTH, height: this.renderHeight };
    }

    protected getFileName(): string {
        return this.fileName;
    }

    protected getBgColor(): string {
        return '#451a03';
    }

    protected paint(context: Canvas2DContext): number {
        this.renderTitle(context);
        this.renderSubtitle(context);
        this.renderRect(context);
        this.renderSectionHeader(context, '[回答内容]');
        this.renderContent(context);
        return this.renderStartY;
    }
}
