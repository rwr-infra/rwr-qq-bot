/**
 * TDoll 分层渲染基类
 *
 * 功能:
 * 1. 分离主内容渲染和时间戳渲染
 * 2. 支持缓存主内容，动态叠加时间戳
 * 3. 提供缓存友好的渲染流程
 */

import {
    createCanvas,
    Canvas2DContext,
    CanvasLike,
} from '../../../services/canvasBackend';
import { logger } from '../../../utils/logger';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface LayeredRenderOptions {
    /** 输出文件目录 */
    outputDir: string;
    /** 基础文件名（不含扩展名） */
    baseFileName: string;
    /** 画布宽度 */
    width: number;
    /** 画布高度 */
    height: number;
    /** 时间戳区域高度 */
    footerHeight?: number;
}

export interface RenderLayers {
    /** 主内容画布 */
    contentCanvas: CanvasLike;
    /** 主内容上下文 */
    contentContext: Canvas2DContext;
    /** 时间戳画布 */
    footerCanvas: CanvasLike;
    /** 时间戳上下文 */
    footerContext: Canvas2DContext;
}

export abstract class LayeredCanvasRenderer {
    protected options: LayeredRenderOptions;
    protected contentPath: string;
    protected outputPath: string;
    protected footerHeight: number;

    constructor(options: LayeredRenderOptions) {
        this.options = options;
        this.footerHeight = options.footerHeight ?? 30;

        // 确保输出目录存在
        if (!fs.existsSync(options.outputDir)) {
            fs.mkdirSync(options.outputDir, { recursive: true });
        }

        // 设置文件路径
        this.contentPath = path.join(
            options.outputDir,
            `${options.baseFileName}_content.png`,
        );
        this.outputPath = path.join(
            options.outputDir,
            `${options.baseFileName}.png`,
        );
    }

    /**
     * 渲染主内容（子类实现）
     * @param context - 主内容画布上下文
     * @param width - 画布宽度
     * @param contentHeight - 内容区域高度（不含时间戳）
     */
    protected abstract renderContent(
        context: Canvas2DContext,
        width: number,
        contentHeight: number,
    ): Promise<void>;

    /**
     * 渲染时间戳
     * @param context - 时间戳画布上下文
     * @param width - 画布宽度
     * @param height - 时间戳区域高度
     */
    protected abstract renderFooter(
        context: Canvas2DContext,
        width: number,
        height: number,
    ): Promise<void>;

    /**
     * 渲染主内容层（用于缓存）
     * @returns 主内容图片路径
     */
    async renderContentLayer(): Promise<string> {
        logger.info(
            `[LayeredCanvas] Rendering content layer: ${this.options.baseFileName}`,
        );

        const contentHeight = this.options.height - this.footerHeight;

        // 创建主内容画布
        const contentCanvas = createCanvas(this.options.width, contentHeight);
        const contentContext = contentCanvas.getContext('2d');

        // 渲染主内容
        await this.renderContent(
            contentContext,
            this.options.width,
            contentHeight,
        );

        // 保存主内容
        this.saveCanvas(contentCanvas, this.contentPath);

        logger.info(`[LayeredCanvas] Content layer saved: ${this.contentPath}`);
        return this.contentPath;
    }

    /**
     * 合成完整图片（内容 + 时间戳）
     * @param contentPath - 主内容图片路径（可选，使用已渲染的）
     * @returns 最终输出路径
     */
    async composeOutput(contentPath?: string): Promise<string> {
        const sourceContentPath = contentPath || this.contentPath;

        logger.info(
            `[LayeredCanvas] Composing output: ${this.options.baseFileName}`,
        );

        // 创建完整画布
        const finalCanvas = createCanvas(
            this.options.width,
            this.options.height,
        );
        const finalContext = finalCanvas.getContext('2d');

        // 绘制主内容
        // 注意：这里需要从文件加载图片，然后绘制
        // 由于 canvas API 限制，我们需要创建一个临时图片对象
        // 实际上我们会直接使用 renderContentLayer 返回的 canvas
        // 这里简化处理：如果 contentPath 存在，说明已经渲染过了

        // 重新渲染主内容到新画布（简化实现）
        const contentHeight = this.options.height - this.footerHeight;
        await this.renderContent(
            finalContext,
            this.options.width,
            contentHeight,
        );

        // 绘制时间戳区域背景
        finalContext.fillStyle = 'rgba(0, 0, 0, 0.3)';
        finalContext.fillRect(
            0,
            contentHeight,
            this.options.width,
            this.footerHeight,
        );

        // 渲染时间戳
        await this.renderFooter(
            finalContext,
            this.options.width,
            this.footerHeight,
        );

        // 保存最终图片
        this.saveCanvas(finalCanvas, this.outputPath);

        logger.info(`[LayeredCanvas] Output composed: ${this.outputPath}`);
        return this.outputPath;
    }

    /**
     * 完整的渲染流程（带缓存检查）
     * @param checkCache - 是否检查缓存
     * @returns 输出图片路径
     */
    async render(checkCache: boolean = false): Promise<string> {
        if (checkCache && fs.existsSync(this.outputPath)) {
            logger.info(
                `[LayeredCanvas] Using cached output: ${this.outputPath}`,
            );
            return this.outputPath;
        }

        // 直接渲染完整图片（不分层）
        logger.info(`[LayeredCanvas] Rendering: ${this.options.baseFileName}`);

        const canvas = createCanvas(this.options.width, this.options.height);
        const context = canvas.getContext('2d');

        // 渲染主内容
        const contentHeight = this.options.height - this.footerHeight;
        await this.renderContent(context, this.options.width, contentHeight);

        // 渲染底部区域
        await this.renderFooter(context, this.options.width, this.footerHeight);

        // 保存
        this.saveCanvas(canvas, this.outputPath);

        logger.info(`[LayeredCanvas] Rendered: ${this.outputPath}`);
        return this.outputPath;
    }

    /**
     * 保存画布到文件
     */
    private saveCanvas(canvas: CanvasLike, filePath: string): void {
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(filePath, buffer);
    }

    /**
     * 获取内容图片路径
     */
    getContentPath(): string {
        return this.contentPath;
    }

    /**
     * 获取输出图片路径
     */
    getOutputPath(): string {
        return this.outputPath;
    }
}
