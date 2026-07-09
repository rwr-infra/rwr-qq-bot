import { type Canvas2DContext } from '../../services/canvasBackend';
import { BaseCanvas, CanvasSize } from '../../services/baseCanvas';

export class WelcomeCanvas extends BaseCanvas {
    private readonly fileName: string;

    private readonly renderWidth = 980;
    private renderHeight = 240;

    constructor(fileName: string) {
        super();
        this.fileName = fileName;
    }

    private renderHeader(context: Canvas2DContext) {
        const outerPaddingX = 20;
        const titleY = 16;

        context.textAlign = 'left';
        context.textBaseline = 'top';
        context.fillStyle = '#fff';

        context.font = 'bold 24pt Consolas';
        context.fillText('欢迎入群', outerPaddingX, titleY);

        this.renderStartY = titleY + 48;
    }

    protected measure(): CanvasSize {
        return { width: this.renderWidth, height: this.renderHeight };
    }

    protected getFileName(): string {
        return this.fileName;
    }

    protected getBgColor(): string {
        return '#451a03';
    }

    protected paint(context: Canvas2DContext): number {
        this.renderHeader(context);
        return this.renderStartY;
    }
}
