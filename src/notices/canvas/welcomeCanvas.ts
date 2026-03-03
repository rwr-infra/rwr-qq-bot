import {
    createCanvas,
    type Canvas2DContext,
} from '../../services/canvasBackend';
import { BaseCanvas } from '../../services/baseCanvas';

export class WelcomeCanvas extends BaseCanvas {
    private readonly fileName: string;

    private readonly renderWidth = 980;
    private renderHeight = 240;

    constructor(fileName: string) {
        super();
        this.fileName = fileName;
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
        context.fillText('欢迎入群', outerPaddingX, titleY);

        this.renderStartY = titleY + 48;
    }

    render() {
        this.record();

        const canvas = createCanvas(this.renderWidth, this.renderHeight);
        const context = canvas.getContext('2d');

        this.renderLayout(context, this.renderWidth, this.renderHeight);
        this.renderBgImg(context, this.renderWidth, this.renderHeight);
        this.renderHeader(context);
        this.renderFooter(context);

        return super.writeFile(canvas, this.fileName);
    }
}
