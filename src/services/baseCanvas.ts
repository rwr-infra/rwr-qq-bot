import * as fs from 'fs';
import * as path from 'path';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { GlobalEnv } from '../types';
import { CanvasImgService } from './canvasImg.service';
import {
    Canvas2DContext,
    CanvasLike,
    createCanvas,
    toPngBuffer,
} from './canvasBackend';
import { buildCanvasFont } from './canvasFonts';
import { CANVAS_COLORS } from './canvasTheme';
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

export const CN_REGEX = new RegExp('[一-龥]');

/** 画布尺寸——由子类的 measure() 计算返回 */
export interface CanvasSize {
    width: number;
    height: number;
}

/**
 * 文件写出接口——把 fs 写盘从画布逻辑中分离出来的接缝(seam)。
 * 生产用 {@link defaultCanvasFileWriter}(真实 fs)，测试可注入假实现以避免触盘。
 */
export interface CanvasFileWriter {
    write(canvas: CanvasLike, fileName: string): string;
}

/** 默认实现: 编码为 PNG 并写入 out/ 目录，带结构化错误包装 */
class FsCanvasFileWriter implements CanvasFileWriter {
    write(canvas: CanvasLike, fileName: string): string {
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

        // recursive: 幂等建目录，并发渲染时不会因 EEXIST 抛错
        fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });

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

export const defaultCanvasFileWriter: CanvasFileWriter = new FsCanvasFileWriter();

export abstract class BaseCanvas {
    startTime?: Dayjs;

    totalFooter = '';
    renderStartY = 0;

    protected readonly fileWriter: CanvasFileWriter;

    constructor(deps?: { fileWriter?: CanvasFileWriter }) {
        this.fileWriter = deps?.fileWriter ?? defaultCanvasFileWriter;
    }

    // ------------------------------------------------------------------
    // 子类钩子(模板方法模式)
    // ------------------------------------------------------------------

    /** 计算画布宽高；可为异步(如需先加载图片素材，可在此 await 并存入实例字段) */
    protected abstract measure(): CanvasSize | Promise<CanvasSize>;

    /** 绘制内容；返回 footer 的起始 Y 坐标(即 renderStartY) */
    protected abstract paint(
        ctx: Canvas2DContext,
        size: CanvasSize,
    ): number | Promise<number>;

    /** 输出文件名 */
    protected abstract getFileName(): string;

    /** 背景填充色(renderBgImg 之前)。默认暖棕底，子类可覆盖 */
    protected getBgColor(): string {
        return CANVAS_COLORS.BG;
    }

    /** 错误上下文中的 scene 标识，默认类名 */
    protected getRenderScene(): string {
        return this.constructor.name;
    }

    /** 错误上下文中的输入摘要(可选) */
    protected getInputSummary(): string | undefined {
        return undefined;
    }

    /**
     * 统一的渲染生命周期(模板方法):
     * record → measure → 建画布 → 填底 + 背景图 → paint → footer → 写文件。
     * 所有子类共享此骨架，异常统一包装为 IMAGE_RENDER_FAILED。
     */
    async render(): Promise<string> {
        try {
            this.record();

            const size = await this.measure();

            const canvas = createCanvas(size.width, size.height);
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = this.getBgColor();
            ctx.fillRect(0, 0, size.width, size.height);
            this.renderBgImg(ctx, size.width, size.height);

            const footerY = await this.paint(ctx, size);
            this.renderStartY = footerY;
            this.renderFooter(ctx);

            return this.writeFile(canvas, this.getFileName());
        } catch (err) {
            const wrapped = asImageRenderError(err, {
                code: 'IMAGE_RENDER_FAILED',
                message: `${this.getRenderScene()} canvas render failed`,
                context: {
                    scene: this.getRenderScene(),
                    fileName: this.getFileName(),
                    inputSummary: this.getInputSummary(),
                },
            });
            logImageRenderError(wrapped);
            throw wrapped;
        }
    }

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

    writeFile(canvas: CanvasLike, fileName: string): string {
        return this.fileWriter.write(canvas, fileName);
    }
}
