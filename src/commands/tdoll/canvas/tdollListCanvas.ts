import { BaseCanvas, CanvasSize } from '../../../services/baseCanvas';
import { Canvas2DContext } from '../../../services/canvasBackend';
import { buildCanvasFont } from '../../../services/canvasFonts';
import {
    drawSegments,
    truncate,
} from '../../../services/canvasHelpers';
import { CANVAS_COLORS } from '../../../services/canvasTheme';
import { ITDollDataItem } from '../types/types';
import { loadTDollAvatarMap } from './assets';
import {
    CARD_GAP,
    CARD_H,
    CARD_W,
    QUERY_HIGHLIGHT_COLOR,
    buildCardModel,
    computeCardGridLayout,
    drawTDollCard,
} from './cardRenderer';

const PAD = 30;
const TITLE_H = 56;
const FOOTER_H = 40;

/**
 * TDoll 匹配列表画布 — 自适应双列卡片(≤3 项单列, ≥4 项双列), 展示全部匹配结果。
 */
export class TDollListCanvas extends BaseCanvas {
    private readonly query: string;
    private readonly tdolls: ITDollDataItem[];
    private readonly fileName: string;

    private avatarMap: Awaited<ReturnType<typeof loadTDollAvatarMap>> | null =
        null;
    private cols = 1;

    constructor(query: string, tdolls: ITDollDataItem[], fileName: string) {
        super();
        this.query = query;
        this.tdolls = tdolls;
        this.fileName = fileName;
    }

    private renderTitle(ctx: Canvas2DContext, width: number): void {
        ctx.textBaseline = 'top';

        // 右侧统计(muted, 右锚定)
        const statText = `共 ${this.tdolls.length} 项`;
        const statFont = buildCanvasFont(12, 'normal');
        ctx.font = statFont;
        const statWidth = ctx.measureText(statText).width;
        drawSegments(
            ctx,
            width - PAD,
            PAD + 8,
            [{ text: statText, color: CANVAS_COLORS.MUTED, font: statFont }],
            'right',
        );

        // 左侧标题: 查询 <query> 匹配结果
        const titleFont = buildCanvasFont(20);
        ctx.font = titleFont;
        const staticWidth = ctx.measureText('查询  匹配结果').width;
        const queryText = truncate(
            ctx,
            this.query,
            Math.max(40, width - PAD * 2 - staticWidth - statWidth - 16),
        );
        drawSegments(ctx, PAD, PAD, [
            { text: '查询 ', color: CANVAS_COLORS.TEXT, font: titleFont },
            { text: queryText, color: QUERY_HIGHLIGHT_COLOR, font: titleFont },
            { text: ' 匹配结果', color: CANVAS_COLORS.TEXT, font: titleFont },
        ]);
    }

    protected async measure(): Promise<CanvasSize> {
        this.avatarMap = await loadTDollAvatarMap(this.tdolls);

        const { cols, rows } = computeCardGridLayout(this.tdolls.length);
        this.cols = cols;
        const width = PAD * 2 + cols * CARD_W + (cols - 1) * CARD_GAP;
        const height =
            PAD + TITLE_H + rows * CARD_H + (rows - 1) * CARD_GAP + FOOTER_H;

        return { width, height };
    }

    protected getFileName(): string {
        return this.fileName;
    }

    protected getBgColor(): string {
        return CANVAS_COLORS.BG;
    }

    protected getRenderScene(): string {
        return 'tdollList:render';
    }

    protected getInputSummary(): string {
        return `query=${this.query}, count=${this.tdolls.length}`;
    }

    protected paint(ctx: Canvas2DContext, size: CanvasSize): number {
        this.renderTitle(ctx, size.width);

        this.tdolls.forEach((tdoll, i) => {
            const col = i % this.cols;
            const row = Math.floor(i / this.cols);
            const x = PAD + col * (CARD_W + CARD_GAP);
            const y = PAD + TITLE_H + row * (CARD_H + CARD_GAP);
            drawTDollCard(
                ctx,
                x,
                y,
                buildCardModel(tdoll, this.query),
                this.avatarMap!,
            );
        });

        return size.height - FOOTER_H;
    }
}
