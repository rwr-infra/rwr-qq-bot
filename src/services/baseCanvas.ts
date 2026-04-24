import * as fs from 'fs';
import * as path from 'path';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { GlobalEnv } from '../types';
import { CanvasImgService } from './canvasImg.service';
import { Canvas2DContext, CanvasLike, toPngBuffer } from './canvasBackend';
import { buildCanvasFont } from './canvasFonts';
import { asImageRenderError } from './imageRenderErrors';
import { logImageRenderError } from './imageRenderLogger';

const getFooterText = (cost: number, endTime: dayjs.Dayjs) => {
    return (
        'RWR QQ Bot' +
        `(cost=${cost}ms, render time=${endTime.format('YYYY-MM-DD HH:mm:ss.SSS')})`
    );
};

const getFixedFooterTime = () => {
    const fixed = process.env.CANVAS_FOOTER_FIXED_TIME;
    if (!fixed) {
        return null;
    }
    const parsed = dayjs(fixed);
    if (!parsed.isValid()) {
        return null;
    }
    return parsed;
};

const OUTPUT_FOLDER = 'out';

export const CN_REGEX = new RegExp('[\u4E00-\u9FA5]');

export class BaseCanvas {
    startTime?: Dayjs;

    totalFooter = '';
    renderStartY = 0;

    constructor() {}

    calcCanvasTextWidth(text: string, base: number): number {
        let countWidth = 0;
        for (let i = 0; i < text.length; ++i) {
            if (CN_REGEX.test(text[i])) {
                countWidth += base * 2;
            } else {
                countWidth += base;
            }
        }

        return countWidth;
    }

    renderBgImg(ctx: Canvas2DContext, width: number, height: number) {
        const path = (process.env as unknown as GlobalEnv).OUTPUT_BG_IMG;
        if (!path) {
            return;
        }
        const img = CanvasImgService.getInstance().getImg(path);
        if (!img) {
            return;
        }
        const imgWidth = img.width;
        const imgHeight = img.height;

        const widthRatio = width / imgWidth;
        const heightRatio = height / imgHeight;
        const scale = Math.min(widthRatio, heightRatio);

        const scaledWidth = imgWidth * scale;
        const scaledHeight = imgHeight * scale;
        const x = (width - scaledWidth) / 2;
        const y = (height - scaledHeight) / 2;

        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

        // 添加半透明蒙层
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; // 半透明黑色
        ctx.fillRect(0, 0, width, height); // 绘制蒙层
    }

    renderFooter(context: Canvas2DContext) {
        if (process.env.CANVAS_FOOTER_DISABLE === '1') {
            return;
        }

        context.fillStyle = '#fff';
        context.font = buildCanvasFont(10);
        context.textAlign = 'left';

        const fixedTime = getFixedFooterTime();
        const endTime = fixedTime ?? dayjs();

        const calcCost = fixedTime ? 0 : endTime.diff(this.startTime);
        const footerText = getFooterText(calcCost, endTime);
        this.totalFooter = footerText;
        context.fillText(footerText, 10, this.renderStartY + 20);
    }

    record() {
        this.startTime = dayjs();
    }

    writeFile(canvas: CanvasLike, fileName: string) {
        let buffer: Buffer;
        try {
            buffer = toPngBuffer(canvas);
        } catch (err) {
            const wrapped = asImageRenderError(err, {
                code: 'IMAGE_ENCODE_FAILED',
                message: 'Failed to encode canvas to PNG',
                context: { scene: 'baseCanvas:encode', fileName },
            });
            logImageRenderError(wrapped);
            throw wrapped;
        }

        if (!fs.existsSync(OUTPUT_FOLDER)) {
            fs.mkdirSync(OUTPUT_FOLDER);
        }

        const outputPath = path.join(
            process.cwd(),
            OUTPUT_FOLDER,
            `./${fileName}`,
        );

        try {
            fs.writeFileSync(outputPath, buffer);
        } catch (err) {
            const wrapped = asImageRenderError(err, {
                code: 'IMAGE_WRITE_FAILED',
                message: 'Failed to write PNG output',
                context: { scene: 'baseCanvas:write', fileName },
            });
            logImageRenderError(wrapped);
            throw wrapped;
        }

        return outputPath;
    }
}
