import * as fs from 'fs';
import * as path from 'path';
import * as echarts from 'echarts';
import { IAnalysisData } from '../types/types';
import { OUTPUT_FOLDER } from '../types/constants';
import { logger } from '../../../utils/logger';
import { CHART_FONT_FAMILY } from '../../../services/canvasFonts';
import { asImageRenderError } from '../../../services/imageRenderErrors';
import { logImageRenderError } from '../../../services/imageRenderLogger';
import { rasterizeSvgToPng } from './svgRasterizer';

/**
 * 图表配置接口
 */
export interface ChartConfig {
    title: string;
    xAxisName: string;
    yAxisName: string;
    data: Array<{ date: string; count: number }>;
    outputFile: string;
}

/**
 * 图表渲染器
 * 负责将数据渲染为 PNG 图表
 */
export class ChartRenderer {
    private readonly width = 800;
    private readonly height = 400;

    /**
     * 渲染图表
     * @param config - 图表配置
     * @returns 输出文件名
     */
    async render(config: ChartConfig): Promise<string> {
        try {
            const chart = echarts.init(null as any, null as any, {
                renderer: 'svg',
                ssr: true,
                width: this.width,
                height: this.height,
            });

            chart.setOption(this.buildChartOption(config));

            const svg = chart.renderToSVGString();
            chart.dispose();

            const buffer = await this.svgToPng(svg);
            await this.savePng(buffer, config.outputFile);

            return config.outputFile;
        } catch (error) {
            this.handleRenderError(error, config);
            throw error;
        }
    }

    /**
     * 构建图表配置
     */
    private buildChartOption(config: ChartConfig): any {
        return {
            backgroundColor: '#fff',
            textStyle: {
                fontFamily: CHART_FONT_FAMILY,
            },
            title: {
                text: config.title,
                textAlign: 'center',
                left: '50%',
                textStyle: {
                    fontFamily: CHART_FONT_FAMILY,
                    fontWeight: 700,
                },
            },
            xAxis: {
                name: config.xAxisName,
                nameLocation: 'center',
                nameGap: 30,
                nameTextStyle: {
                    fontFamily: CHART_FONT_FAMILY,
                    fontWeight: 700,
                },
                axisLabel: {
                    fontFamily: CHART_FONT_FAMILY,
                },
                type: 'category',
                data: config.data.map((d) => d.date),
            },
            yAxis: {
                name: config.yAxisName,
                nameGap: 30,
                nameLocation: 'end',
                nameTextStyle: {
                    fontFamily: CHART_FONT_FAMILY,
                    fontWeight: 700,
                },
                axisLabel: {
                    fontFamily: CHART_FONT_FAMILY,
                },
                type: 'value',
            },
            series: [
                {
                    data: config.data.map((d) => d.count),
                    label: {
                        show: false,
                    },
                    type: 'line',
                },
                {
                    data: config.data.map((d) => d.count),
                    label: {
                        fontFamily: CHART_FONT_FAMILY,
                        show: true,
                        position: 'top',
                    },
                    type: 'bar',
                },
            ],
        };
    }

    /**
     * 将 SVG 转换为 PNG（使用 skia-canvas 栅格化，附带针对 ECharts SVG 的兼容清洗）
     */
    private async svgToPng(svg: string): Promise<Buffer> {
        return rasterizeSvgToPng(svg, this.width, this.height);
    }

    /**
     * 保存 PNG 文件
     */
    private async savePng(buffer: Buffer, fileName: string): Promise<void> {
        const outputDir = path.join(process.cwd(), OUTPUT_FOLDER);
        const outputPath = path.join(outputDir, `./${fileName}`);

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        await fs.promises.writeFile(outputPath, buffer);
    }

    /**
     * 处理渲染错误
     */
    private handleRenderError(error: unknown, config: ChartConfig): void {
        const wrapped = asImageRenderError(error, {
            code: 'IMAGE_RENDER_FAILED',
            message: `Failed to render chart: ${config.title}`,
            context: {
                scene: 'ChartRenderer',
                fileName: config.outputFile,
            },
        });
        logImageRenderError(wrapped);
        logger.error('ChartRenderer failed', wrapped);
    }
}
