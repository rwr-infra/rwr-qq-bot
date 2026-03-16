import {
    createCanvas,
    Canvas2DContext,
    ImageLike,
    loadImageFrom,
} from '../../../services/canvasBackend';
import { BaseCanvas } from '../../../services/baseCanvas';
import {
    ITDollDataItem,
    ITDollSkinDataItem,
    ITDollSkinImage,
} from '../types/types';
import { resizeImg } from '../../../utils/imgproxy';
import { CANVAS_STYLE, TDOLL_URL_PREFIX } from '../types/constants';
import { calcCanvasTextWidth } from '../../servers/utils/utils';
import { asImageRenderError } from '../../../services/imageRenderErrors';
import { logImageRenderError } from '../../../services/imageRenderLogger';
import { logger } from '../../../utils/logger';

interface RenderDimensions {
    width: number;
    height: number;
    maxWidth: number;
    maxRectWidth: number;
}

interface RenderState {
    startY: number;
    title: string;
    footer: string;
}

interface SkinItem {
    index: number;
    title: string;
    value: string;
    image?: ITDollSkinImage;
}

/**
 * Canvas class for rendering T-Doll skin information
 * Handles the layout and rendering of T-Doll details including images and skin information
 */
export class TDollSkin2Canvas extends BaseCanvas {
    private dimensions: RenderDimensions = {
        width: 0,
        height: 0,
        maxWidth: 0,
        maxRectWidth: 0,
    };

    private state: RenderState = {
        startY: 0,
        title: '',
        footer: '',
    };

    // Image caches
    protected tdollImgMap: Map<string, ImageLike> = new Map(); // key: tdoll id
    protected tdollSkinImgMap: Map<string, ImageLike> = new Map(); // key: tdollskin id

    protected readonly fileName: string;
    protected readonly query: string;
    protected readonly tdoll?: ITDollDataItem;
    protected readonly tdolls: ITDollDataItem[];
    protected readonly skinsRecord: Record<string, ITDollSkinDataItem>;
    protected readonly skinList?: SkinItem[];

    /**
     * Creates a new TDollSkin2Canvas instance
     * @param query - The search query/ID for the T-Doll
     * @param tdolls - Array of T-Doll data
     * @param record - Record of T-Doll skin data
     * @param fileName - Output file name for the canvas
     */
    constructor(
        query: string,
        tdolls: ITDollDataItem[],
        record: Record<string, ITDollSkinDataItem>,
        fileName: string,
    ) {
        super();
        this.fileName = fileName;
        this.query = query;
        this.tdolls = tdolls;
        this.tdoll = tdolls.find((tdoll) => tdoll.id === query);
        this.skinsRecord = record;

        const matchSkinRecord = record[query];
        if (matchSkinRecord?.length) {
            this.skinList = matchSkinRecord.filter(
                (skin): skin is Required<SkinItem> => {
                    return Boolean(
                        skin &&
                        skin.image &&
                        skin.index !== undefined &&
                        skin.title &&
                        skin.value,
                    );
                },
            );
        }
    }

    // Rest of the implementation remains the same...
    /**
     * Applies the base canvas style settings
     */
    private applyBaseStyle(context: Canvas2DContext): void {
        context.font = CANVAS_STYLE.FONT;
        context.textAlign = 'left';
        context.textBaseline = 'top';
        context.fillStyle = CANVAS_STYLE.TEXT_COLOR;
    }

    /**
     * Loads all required images for the T-Doll and its skins
     * @throws Error if image loading fails
     */
    protected async loadAllImg(): Promise<void> {
        if (!this.tdoll) return;

        try {
            // Load T-Doll avatar
            const avatarUrl = resizeImg(
                this.tdoll.avatar,
                CANVAS_STYLE.IMAGE_SIZE,
                CANVAS_STYLE.IMAGE_SIZE,
            );
            const avatarImg = await loadImageFrom(avatarUrl);
            this.tdollImgMap.set(this.tdoll.id, avatarImg);

            // Load skin images
            if (this.skinList?.length) {
                await Promise.all(
                    this.skinList.map(async (skin) => {
                        if (!skin.image) return;

                        const imgRawUrl = this.getFullImageUrl(skin.image.pic);
                        const imgResizeUrl = resizeImg(imgRawUrl, 150, 150);
                        logger.info(`Loading skin image from URL: ${imgResizeUrl}`);
                        const skinImg = await loadImageFrom(imgResizeUrl);

                        this.tdollSkinImgMap.set(skin.value, skinImg);
                    }),
                );
            }
        } catch (error) {
            const wrapped = asImageRenderError(error, {
                code: 'IMAGE_LOAD_FAILED',
                message: `Failed to load image for tdoll ${this.tdoll.id}`,
                context: {
                    scene: 'tdollSkin:loadAllImg',
                    inputSummary: this.tdoll.id,
                },
            });
            logImageRenderError(wrapped);
            throw wrapped;
        }
    }

    /**
     * Constructs the full image URL for a skin
     */
    private getFullImageUrl(picUrl: string): string {
        return picUrl.includes(TDOLL_URL_PREFIX)
            ? picUrl
            : `${TDOLL_URL_PREFIX}${picUrl}`;
    }

    /**
     * Gets the title section components
     */
    protected getTitleSection(): {
        staticSection: string;
        userSection: string;
        staticSection2: string;
    } {
        return {
            staticSection: '查询 ',
            userSection: this.query,
            staticSection2: ' 匹配结果',
        };
    }

    /**
     * Gets the T-Doll section components
     */
    protected getTDollSection(): {
        staticSection: string;
        noSection: string;
        staticSection2: string;
    } {
        return {
            staticSection: 'No.',
            noSection: this.tdoll?.id || '',
            staticSection2: ` ${this.tdoll?.nameIngame || ''} ${
                this.tdoll?.type || ''
            }`,
        };
    }

    /**
     * Measures and sets the title dimensions
     */
    protected measureTitle(): void {
        const section = this.getTitleSection();
        const title =
            section.staticSection +
            section.userSection +
            section.staticSection2;
        this.state.title = title;

        const titleWidth = this.calcCanvasTextWidth(title, 20) + 20;
        this.dimensions.maxWidth = Math.max(
            this.dimensions.maxWidth,
            titleWidth,
        );
    }

    /**
     * Measures and sets the content dimensions
     */
    protected measureContent(): void {
        if (!this.tdoll) return;

        // Measure T-Doll section
        const tDollSection = this.getTDollSection();
        const totalTitle = calcCanvasTextWidth(
            tDollSection.staticSection +
                tDollSection.noSection +
                tDollSection.staticSection2,
            20,
        );
        this.dimensions.maxWidth = Math.max(
            this.dimensions.maxWidth,
            totalTitle,
        );

        // Measure skin sections
        this.skinList?.forEach((tdoll, index) => {
            const skinTitle = `${index + 1}. ${tdoll.title} ID:${tdoll.value}`;
            const skinTitleWidth = this.calcCanvasTextWidth(skinTitle, 20);
            this.dimensions.maxWidth = Math.max(
                this.dimensions.maxWidth,
                skinTitleWidth,
                150, // minimum width for images
            );
        });

        // Calculate total height
        this.dimensions.height =
            120 + // base height
            20 + // title height
            CANVAS_STYLE.PADDING + // title spacing
            40 + // title image height
            CANVAS_STYLE.PADDING + // padding
            this.getSkinsHeight(); // skins section height
    }

    /**
     * Renders the background layout
     */
    private renderLayout(
        context: Canvas2DContext,
        width: number,
        height: number,
    ): void {
        context.fillStyle = '#451a03';
        context.fillRect(0, 0, width, height);
    }

    /**
     * Renders the main title at the top of the canvas
     */
    private renderTitle(context: Canvas2DContext): void {
        this.applyBaseStyle(context);
        const section = this.getTitleSection();
        let currentX = CANVAS_STYLE.PADDING;

        // Render static section
        context.fillStyle = CANVAS_STYLE.TEXT_COLOR;
        context.fillText(section.staticSection, currentX, CANVAS_STYLE.PADDING);
        currentX += context.measureText(section.staticSection).width;

        // Render user section
        context.fillStyle = '#22d3ee';
        context.fillText(section.userSection, currentX, CANVAS_STYLE.PADDING);
        currentX += context.measureText(section.userSection).width;

        // Render static section 2
        context.fillStyle = CANVAS_STYLE.TEXT_COLOR;
        context.fillText(
            section.staticSection2,
            currentX,
            CANVAS_STYLE.PADDING,
        );

        this.state.startY = CANVAS_STYLE.TITLE_OFFSET;
    }

    /**
     * Renders the T-Doll title section
     * @returns The total width of the rendered title
     */
    private renderTdollTitle(context: Canvas2DContext): number {
        const section = this.getTDollSection();
        let currentX = CANVAS_STYLE.PADDING * 2;
        const y = this.state.startY;

        // Render "No."
        context.fillStyle = CANVAS_STYLE.TEXT_COLOR;
        context.fillText(section.staticSection, currentX, y);
        currentX += context.measureText(section.staticSection).width;

        // Render ID number
        context.fillStyle = '#f97316';
        context.fillText(section.noSection, currentX, y);
        currentX += context.measureText(section.noSection).width;

        // Render name and type
        context.fillStyle = CANVAS_STYLE.TEXT_COLOR;
        context.fillText(section.staticSection2, currentX, y);
        const nameSectionWidth = context.measureText(
            section.staticSection2,
        ).width;

        this.state.startY += CANVAS_STYLE.PADDING * 3;

        return currentX + nameSectionWidth - CANVAS_STYLE.PADDING * 2;
    }

    /**
     * Renders the T-Doll avatar image
     * @returns The width of the rendered image
     */
    private renderTdollImage(context: Canvas2DContext): number {
        if (!this.tdoll) return 0;

        const image = this.tdollImgMap.get(this.tdoll.id);
        if (!image) return 0;

        const x = CANVAS_STYLE.PADDING * 2;
        context.drawImage(
            image,
            x,
            this.state.startY,
            CANVAS_STYLE.IMAGE_SIZE,
            CANVAS_STYLE.IMAGE_SIZE,
        );

        this.state.startY += CANVAS_STYLE.IMAGE_SIZE + CANVAS_STYLE.PADDING;
        return CANVAS_STYLE.IMAGE_SIZE;
    }

    /**
     * Calculates the total height needed for skin sections
     */
    protected getSkinsHeight(): number {
        const SKIN_SECTION_HEIGHT = 10 + 40 + 150; // spacing + title + image
        return (this.skinList?.length || 0) * SKIN_SECTION_HEIGHT;
    }

    /**
     * Renders the T-Doll skin sections
     * @returns The maximum width of the rendered skin sections
     */
    private renderTdollSkins(context: Canvas2DContext): number {
        if (!this.tdoll || !this.skinList?.length) {
            this.renderStartY = this.state.startY;
            return 0;
        }

        let maxWidth = 0;
        const x = CANVAS_STYLE.PADDING * 2;

        this.skinList.forEach((skin, index) => {
            // Render skin title
            this.state.startY += CANVAS_STYLE.PADDING;

            // 分段渲染标题文本
            context.fillStyle = CANVAS_STYLE.TEXT_COLOR;
            const prefix = `${index + 1}. ${skin.title} ID:`;
            context.fillText(prefix, x, this.state.startY);

            // 计算前缀宽度
            const prefixWidth = context.measureText(prefix).width;

            // 高亮渲染 skin.value
            context.fillStyle = '#059669';
            context.fillText(skin.value, x + prefixWidth, this.state.startY);

            // 计算总宽度
            const totalWidth =
                prefixWidth + context.measureText(skin.value).width;
            maxWidth = Math.max(maxWidth, totalWidth);

            // Render skin image
            this.state.startY += CANVAS_STYLE.LINE_HEIGHT;
            const image = this.tdollSkinImgMap.get(skin.value);
            if (image) {
                context.drawImage(image, x, this.state.startY, 150, 150);
                maxWidth = Math.max(maxWidth, 150);
            }
            // Even if no image, still increase startY to keep spacing
            this.state.startY += 150;
        });

        this.renderStartY = this.state.startY;

        return maxWidth;
    }

    /**
     * Renders all content sections
     */
    private renderContent(context: Canvas2DContext): void {
        this.applyBaseStyle(context);
        this.dimensions.maxRectWidth = 0;

        this.state.startY += 10;

        // Render each section and track maximum width
        const sections = [
            this.renderTdollTitle(context),
            this.renderTdollImage(context),
            this.renderTdollSkins(context),
        ];

        this.dimensions.maxRectWidth = Math.max(...sections);
    }

    /**
     * Renders the border rectangle around the content
     */
    private renderRect(context: Canvas2DContext): void {
        const rectHeight =
            20 + // title height
            10 + // title spacing
            40 + // title image height
            CANVAS_STYLE.PADDING + // padding
            this.getSkinsHeight() + // skins height
            CANVAS_STYLE.PADDING * 2; // top/bottom padding

        context.strokeStyle = '#f48225';
        context.rect(
            CANVAS_STYLE.PADDING,
            this.state.startY + 10,
            this.dimensions.maxRectWidth + CANVAS_STYLE.PADDING * 2,
            rectHeight,
        );
        context.stroke();

        this.state.startY += CANVAS_STYLE.PADDING;
    }

    /**
     * Measures all canvas dimensions before rendering
     */
    protected measureRender(): void {
        this.measureTitle();
        this.measureContent();

        const canvas = createCanvas(
            this.dimensions.maxWidth,
            this.dimensions.height,
        );
        const context = canvas.getContext('2d');

        // Measure each section
        this.renderTitle(context);
        const titleWidth = context.measureText(this.state.title).width + 30;

        this.renderContent(context);
        const listWidth = this.dimensions.maxRectWidth + 40;

        this.renderFooter(context);
        const footerWidth = context.measureText(this.totalFooter).width + 30;

        // Set final render width
        this.dimensions.width = Math.max(titleWidth, listWidth, footerWidth);
    }

    /**
     * Renders the complete canvas and saves to file
     * @returns Promise resolving to the file path
     */
    public async render(): Promise<string> {
        try {
            await this.loadAllImg();
            this.record();
            this.measureRender();

            const canvas = createCanvas(
                this.dimensions.width,
                this.dimensions.height,
            );
            const context = canvas.getContext('2d');

            // Render all components
            this.renderLayout(
                context,
                this.dimensions.width,
                this.dimensions.height,
            );
            this.renderBgImg(
                context,
                this.dimensions.width,
                this.dimensions.height,
            );
            this.renderTitle(context);
            this.renderRect(context);
            this.renderContent(context);
            this.renderFooter(context);

            return super.writeFile(canvas, this.fileName);
        } catch (error) {
            const wrapped = asImageRenderError(error, {
                code: 'IMAGE_RENDER_FAILED',
                message: 'Failed to render tdoll skin canvas',
                context: { scene: 'tdollSkin:render', fileName: this.fileName },
            });
            logImageRenderError(wrapped);
            throw wrapped;
        }
    }
}
