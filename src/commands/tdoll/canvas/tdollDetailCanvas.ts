import { BaseCanvas } from '../../../services/baseCanvas';
import {
    Canvas2DContext,
    ImageLike,
    createCanvas,
} from '../../../services/canvasBackend';
import { buildCanvasFont } from '../../../services/canvasFonts';
import { drawSegments } from '../../../services/canvasHelpers';
import { CANVAS_COLORS } from '../../../services/canvasTheme';
import { asImageRenderError } from '../../../services/imageRenderErrors';
import { logImageRenderError } from '../../../services/imageRenderLogger';
import { ITDollDataItem, ITDollSkinDataItem } from '../types/types';
import { loadSkinImageMap, loadTDollAvatarMap } from './assets';
import {
    CARD_H,
    QUERY_HIGHLIGHT_COLOR,
    TDollCardModel,
    buildCardModel,
    drawTDollCard,
} from './cardRenderer';
import {
    SKIN_GRID_W,
    SkinGridItem,
    buildSkinGridItems,
    drawSkinGrid,
    measureSkinGridHeight,
} from './skinGridRenderer';

const PAD = 30;
const TITLE_H = 56;
const SECTION_HEADER_H = 40;
const FOOTER_H = 40;
const WIDTH = PAD * 2 + SKIN_GRID_W;

/**
 * TDoll 详情画布 — 数据卡 + 皮肤 3 列网格合并为一张图。
 * 同时服务 #td 单结果和 #ts 皮肤查询。
 */
export class TDollDetailCanvas extends BaseCanvas {
    private readonly query: string;
    private readonly tdoll?: ITDollDataItem;
    private readonly skinItems: SkinGridItem[];
    private readonly fileName: string;

    constructor(
        query: string,
        tdolls: ITDollDataItem[],
        record: Record<string, ITDollSkinDataItem>,
        fileName: string,
    ) {
        super();
        this.query = query;
        this.tdoll = tdolls.find((tdoll) => tdoll.id === query);
        this.skinItems = buildSkinGridItems(record[query]);
        this.fileName = fileName;
    }

    private buildCardModelSafe(): TDollCardModel {
        if (this.tdoll) {
            return buildCardModel(this.tdoll, this.query);
        }
        // 数据缺失时的降级卡(皮肤记录存在但人形数据未收录)
        return {
            id: this.query,
            name: '未知人形',
            typeText: '',
            tdollClass: undefined,
            isMod: false,
            query: '',
        };
    }

    private renderTitle(ctx: Canvas2DContext): void {
        ctx.textBaseline = 'top';
        const titleFont = buildCanvasFont(20);
        drawSegments(ctx, PAD, PAD, [
            { text: '查询 ', color: CANVAS_COLORS.TEXT, font: titleFont },
            {
                text: this.query,
                color: QUERY_HIGHLIGHT_COLOR,
                font: titleFont,
            },
            { text: ' 匹配结果', color: CANVAS_COLORS.TEXT, font: titleFont },
        ]);
    }

    private renderSectionHeader(ctx: Canvas2DContext, y: number): number {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = CANVAS_COLORS.ACCENT;
        ctx.fillRect(PAD, y + 2, 4, 20);
        ctx.font = buildCanvasFont(16);
        ctx.fillStyle = CANVAS_COLORS.TEXT;
        ctx.fillText(`皮肤 (${this.skinItems.length})`, PAD + 14, y);
        return y + SECTION_HEADER_H;
    }

    async render(): Promise<string> {
        try {
            this.record();

            const [avatarMap, skinMap] = await Promise.all([
                this.tdoll
                    ? loadTDollAvatarMap([this.tdoll])
                    : Promise.resolve(new Map<string, ImageLike>()),
                loadSkinImageMap(this.skinItems),
            ]);

            const gridH = measureSkinGridHeight(this.skinItems.length);
            const height =
                PAD + TITLE_H + CARD_H + 16 + SECTION_HEADER_H + gridH + FOOTER_H;

            const canvas = createCanvas(WIDTH, height);
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = CANVAS_COLORS.BG;
            ctx.fillRect(0, 0, WIDTH, height);
            this.renderBgImg(ctx, WIDTH, height);

            this.renderTitle(ctx);

            let y = PAD + TITLE_H;
            y = drawTDollCard(
                ctx,
                PAD,
                y,
                this.buildCardModelSafe(),
                avatarMap,
                SKIN_GRID_W,
            );

            y = this.renderSectionHeader(ctx, y + 16);
            drawSkinGrid(ctx, PAD, y, this.skinItems, skinMap);

            this.renderStartY = height - FOOTER_H;
            this.renderFooter(ctx);

            return this.writeFile(canvas, this.fileName);
        } catch (err) {
            const wrapped = asImageRenderError(err, {
                code: 'IMAGE_RENDER_FAILED',
                message: 'TDoll detail canvas render failed',
                context: {
                    scene: 'tdollDetail:render',
                    fileName: this.fileName,
                    inputSummary: `query=${this.query}, skins=${this.skinItems.length}`,
                },
            });
            logImageRenderError(wrapped);
            throw wrapped;
        }
    }
}
