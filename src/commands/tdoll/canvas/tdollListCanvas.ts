import { BaseCanvas } from '../../../services/baseCanvas';
import { Canvas2DContext, createCanvas } from '../../../services/canvasBackend';
import { buildCanvasFont } from '../../../services/canvasFonts';
import {
    drawSegments,
    truncate,
} from '../../../services/canvasHelpers';
import { CANVAS_COLORS } from '../../../services/canvasTheme';
import { asImageRenderError } from '../../../services/imageRenderErrors';
import { logImageRenderError } from '../../../services/imageRenderLogger';
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

    async render(): Promise<string> {
        try {
            this.record();

            const imgMap = await loadTDollAvatarMap(this.tdolls);

            const { cols, rows } = computeCardGridLayout(this.tdolls.length);
            const width = PAD * 2 + cols * CARD_W + (cols - 1) * CARD_GAP;
            const height =
                PAD +
                TITLE_H +
                rows * CARD_H +
                (rows - 1) * CARD_GAP +
                FOOTER_H;

            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = CANVAS_COLORS.BG;
            ctx.fillRect(0, 0, width, height);
            this.renderBgImg(ctx, width, height);

            this.renderTitle(ctx, width);

            this.tdolls.forEach((tdoll, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const x = PAD + col * (CARD_W + CARD_GAP);
                const y = PAD + TITLE_H + row * (CARD_H + CARD_GAP);
                drawTDollCard(
                    ctx,
                    x,
                    y,
                    buildCardModel(tdoll, this.query),
                    imgMap,
                );
            });

            this.renderStartY = height - FOOTER_H;
            this.renderFooter(ctx);

            return this.writeFile(canvas, this.fileName);
        } catch (err) {
            const wrapped = asImageRenderError(err, {
                code: 'IMAGE_RENDER_FAILED',
                message: 'TDoll list canvas render failed',
                context: {
                    scene: 'tdollList:render',
                    fileName: this.fileName,
                    inputSummary: `query=${this.query}, count=${this.tdolls.length}`,
                },
            });
            logImageRenderError(wrapped);
            throw wrapped;
        }
    }
}
