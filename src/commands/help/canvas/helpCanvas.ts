import {
    createCanvas,
    type Canvas2DContext,
} from '../../../services/canvasBackend';
import { BaseCanvas } from '../../../services/baseCanvas';

export type HelpCanvasModel =
    | {
          mode: 'list';
          prefix: string;
          items: Array<{ name: string; alias?: string; description: string }>;
      }
    | {
          mode: 'detail';
          prefix: string;
          name: string;
          alias?: string;
          description: string;
          hints: string[];
      }
    | {
          mode: 'not_found';
          prefix: string;
          query: string;
      }
    | {
          mode: 'welcome';
          title: string;
          subtitle?: string;
          prefix: string;
          items: Array<{ name: string; alias?: string; description: string }>;
      };

type WrappedEntry = {
    cmdLabel: string;
    descLines: string[];
};

function wrapText(
    context: Canvas2DContext,
    text: string,
    maxWidth: number,
): string[] {
    const normalized = text.replace(/\r\n/g, '\n');
    const paragraphs = normalized.split('\n');
    const lines: string[] = [];

    for (const paragraph of paragraphs) {
        if (!paragraph) {
            lines.push('');
            continue;
        }

        let current = '';
        for (const ch of paragraph) {
            const next = current + ch;
            const width = context.measureText(next).width;
            if (width > maxWidth && current) {
                lines.push(current);
                current = ch;
            } else {
                current = next;
            }
        }
        if (current) {
            lines.push(current);
        }
    }

    return lines;
}

export class HelpCanvas extends BaseCanvas {
    private readonly model: HelpCanvasModel;
    private readonly fileName: string;

    private readonly renderWidth = 980;
    private renderHeight = 600;

    private headerLines: string[] = [];
    private contentLines: string[] = [];
    private wrappedEntries: WrappedEntry[] = [];

    private cmdColWidth = 220;
    private boxY = 0;
    private boxHeight = 0;

    constructor(model: HelpCanvasModel, fileName: string) {
        super();
        this.model = model;
        this.fileName = fileName;
    }

    private measure(): void {
        const tmp = createCanvas(1, 1);
        const ctx = tmp.getContext('2d');

        const outerPaddingX = 20;
        const boxPadding = 18;
        const boxWidth = this.renderWidth - outerPaddingX * 2;
        const textX = outerPaddingX + boxPadding;
        const textMaxWidth = boxWidth - boxPadding * 2;

        ctx.font = 'bold 14pt Consolas';
        let subtitle = '';
        if (this.model.mode === 'list') {
            subtitle = `共 ${this.model.items.length} 个命令 | 用法: ${this.model.prefix}help <cmd> | 也可用 ${this.model.prefix}h`;
        } else if (this.model.mode === 'detail') {
            subtitle = `别名: ${this.model.alias ? this.model.prefix + this.model.alias : '无'} | 用法: ${this.model.prefix}help ${this.model.name}`;
        } else if (this.model.mode === 'welcome') {
            subtitle =
                this.model.subtitle ??
                `用法: ${this.model.prefix}help <cmd> | 也可用 ${this.model.prefix}h`;
        } else {
            subtitle = `用法: ${this.model.prefix}help | ${this.model.prefix}help <cmd>`;
        }

        this.headerLines = wrapText(
            ctx,
            subtitle,
            this.renderWidth - outerPaddingX * 2,
        );

        this.wrappedEntries = [];
        this.contentLines = [];

        ctx.font = 'bold 16pt Consolas';

        if (this.model.mode === 'list' || this.model.mode === 'welcome') {
            const items = this.model.items;
            const cmdWidths = items.map((it) => {
                const label = `${this.model.prefix}${it.name}${it.alias ? `(${it.alias})` : ''}`;
                return ctx.measureText(label).width;
            });
            const maxCmdWidth = Math.max(0, ...cmdWidths);
            this.cmdColWidth = Math.max(
                140,
                Math.min(
                    Math.ceil(maxCmdWidth),
                    Math.floor(textMaxWidth * 0.35),
                ),
            );

            const descStartX = textX + this.cmdColWidth + 12;
            const descMaxWidth =
                outerPaddingX + boxWidth - boxPadding - descStartX;

            for (const it of items) {
                const cmdLabel = `${this.model.prefix}${it.name}${it.alias ? `(${it.alias})` : ''}`;
                ctx.font = 'bold 16pt Consolas';
                const descLines = wrapText(
                    ctx,
                    it.description,
                    Math.max(60, descMaxWidth),
                );
                this.wrappedEntries.push({
                    cmdLabel,
                    descLines: descLines.length ? descLines : [''],
                });
            }
        } else if (this.model.mode === 'detail') {
            ctx.font = 'bold 16pt Consolas';
            this.contentLines.push('描述:');
            ctx.font = 'bold 14pt Consolas';
            this.contentLines.push(
                ...wrapText(ctx, this.model.description, textMaxWidth),
            );
            this.contentLines.push('');

            ctx.font = 'bold 16pt Consolas';
            this.contentLines.push('用法:');
            ctx.font = 'bold 14pt Consolas';
            if (this.model.hints.length) {
                for (const h of this.model.hints) {
                    const bullet = `- ${h}`;
                    this.contentLines.push(
                        ...wrapText(ctx, bullet, textMaxWidth),
                    );
                    this.contentLines.push('');
                }
                while (
                    this.contentLines.length &&
                    this.contentLines[this.contentLines.length - 1] === ''
                ) {
                    this.contentLines.pop();
                }
            } else {
                this.contentLines.push('暂无更多帮助');
            }
        } else {
            ctx.font = 'bold 16pt Consolas';
            this.contentLines.push('提示:');
            ctx.font = 'bold 14pt Consolas';
            this.contentLines.push(
                ...wrapText(
                    ctx,
                    `使用 ${this.model.prefix}help 查看列表，或 ${this.model.prefix}help <cmd> 查看详细。`,
                    textMaxWidth,
                ),
            );
        }

        const titleHeight = 24 + 18;
        const subtitleLineHeight = 22;
        const headerHeight =
            titleHeight + 8 + this.headerLines.length * subtitleLineHeight;

        const boxTopGap = 12;
        this.boxY = Math.ceil(16 + headerHeight + boxTopGap);

        const bodyLineHeight = 28;
        const smallLineHeight = 22;
        let contentHeight = 0;

        if (this.model.mode === 'list' || this.model.mode === 'welcome') {
            const entryGap = 10;
            for (const e of this.wrappedEntries) {
                contentHeight += e.descLines.length * bodyLineHeight + entryGap;
            }
            if (this.wrappedEntries.length) {
                contentHeight -= entryGap;
            }
        } else {
            for (const line of this.contentLines) {
                contentHeight += line
                    ? smallLineHeight
                    : Math.floor(smallLineHeight * 0.6);
            }
        }

        this.boxHeight = Math.ceil(boxPadding * 2 + contentHeight);

        const footerHeight = 44;
        this.renderHeight = this.boxY + this.boxHeight + footerHeight;
    }

    private renderLayout(
        context: Canvas2DContext,
        width: number,
        height: number,
    ) {
        context.fillStyle = '#451a03';
        context.fillRect(0, 0, width, height);
    }

    private renderHeader(context: Canvas2DContext) {
        const outerPaddingX = 20;
        const titleY = 16;

        context.textAlign = 'left';
        context.textBaseline = 'top';
        context.fillStyle = '#fff';

        context.font = 'bold 24pt Consolas';
        let title = '';
        if (this.model.mode === 'list') {
            title = '帮助列表';
        } else if (this.model.mode === 'detail') {
            title = `帮助: ${this.model.prefix}${this.model.name}`;
        } else if (this.model.mode === 'welcome') {
            title = this.model.title;
        } else {
            title = `未找到命令: ${this.model.query}`;
        }
        context.fillText(title, outerPaddingX, titleY);

        context.font = 'bold 14pt Consolas';
        context.fillStyle = '#a5f3fc';
        let y = titleY + 42;
        for (const line of this.headerLines) {
            context.fillText(line, outerPaddingX, y);
            y += 22;
        }
    }

    private renderBox(context: Canvas2DContext) {
        const outerPaddingX = 20;

        context.strokeStyle = '#f48225';
        context.lineWidth = 2;
        context.beginPath();
        context.rect(
            outerPaddingX,
            this.boxY,
            this.renderWidth - outerPaddingX * 2,
            this.boxHeight,
        );
        context.stroke();
    }

    private renderContent(context: Canvas2DContext) {
        const outerPaddingX = 20;
        const boxPadding = 18;
        const boxWidth = this.renderWidth - outerPaddingX * 2;
        const textX = outerPaddingX + boxPadding;
        const textMaxWidth = boxWidth - boxPadding * 2;
        const startY = this.boxY + boxPadding;

        context.textAlign = 'left';
        context.textBaseline = 'top';

        if (this.model.mode === 'list' || this.model.mode === 'welcome') {
            const cmdX = textX;
            const descX = textX + this.cmdColWidth + 12;
            const descMaxWidth = outerPaddingX + boxWidth - boxPadding - descX;

            let y = startY;
            for (const entry of this.wrappedEntries) {
                context.font = 'bold 16pt Consolas';
                context.fillStyle = '#22d3ee';
                context.fillText(entry.cmdLabel, cmdX, y);

                context.fillStyle = '#fff';
                for (let i = 0; i < entry.descLines.length; i += 1) {
                    const line = entry.descLines[i];
                    const lineY = y + i * 28;
                    context.fillText(
                        line,
                        descX,
                        lineY,
                        Math.max(60, descMaxWidth),
                    );
                }

                y += entry.descLines.length * 28 + 10;
            }
        } else {
            let y = startY;
            for (const line of this.contentLines) {
                if (!line) {
                    y += Math.floor(22 * 0.6);
                    continue;
                }
                const isSection = line.endsWith(':');
                context.font = isSection
                    ? 'bold 16pt Consolas'
                    : 'bold 14pt Consolas';
                context.fillStyle = isSection ? '#22d3ee' : '#fff';
                context.fillText(line, textX, y, textMaxWidth);
                y += 22;
            }
        }

        this.renderStartY = this.boxY + this.boxHeight;
    }

    render() {
        this.record();
        this.measure();

        const canvas = createCanvas(this.renderWidth, this.renderHeight);
        const context = canvas.getContext('2d');

        this.renderLayout(context, this.renderWidth, this.renderHeight);
        this.renderBgImg(context, this.renderWidth, this.renderHeight);
        this.renderHeader(context);
        this.renderBox(context);
        this.renderContent(context);
        this.renderFooter(context);

        return super.writeFile(canvas, this.fileName);
    }
}
