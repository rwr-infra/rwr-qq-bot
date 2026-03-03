import * as fs from 'fs';
import * as path from 'path';
import * as echarts from 'echarts';
import { Resvg } from '@resvg/resvg-js';
import { IServerAnalyticsRecord } from '../types/types';
import { OUTPUT_FOLDER } from '../types/constants';
import { logger } from '../../../utils/logger';
import { asImageRenderError } from '../../../services/imageRenderErrors';
import { logImageRenderError } from '../../../services/imageRenderLogger';

export interface ServerChartConfig {
    title: string;
    records: IServerAnalyticsRecord[];
    outputFile: string;
}

export class ServerChartRenderer {
    private readonly width = 1000;
    private readonly height = 600;

    async render(config: ServerChartConfig): Promise<string> {
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

    private buildChartOption(config: ServerChartConfig): any {
        const allHours = new Set<string>();
        config.records.forEach((record) => {
            record.data.forEach((d) => allHours.add(d.date));
        });
        const sortedHours = Array.from(allHours).sort((a, b) => {
            const hourA = parseInt(a);
            const hourB = parseInt(b);
            return hourA - hourB;
        });

        const colors = [
            '#5470c6',
            '#91cc75',
            '#fac858',
            '#ee6666',
            '#73c0de',
            '#3ba272',
            '#fc8452',
            '#9a60b4',
            '#ea7ccc',
            '#48b8d0',
        ];

        const series = config.records.map((record, index) => {
            const dataMap = new Map(record.data.map((d) => [d.date, d.count]));
            const data = sortedHours.map((hour) => dataMap.get(hour) ?? 0);

            return {
                name:
                    record.serverName.length > 20
                        ? record.serverName.substring(0, 20) + '...'
                        : record.serverName,
                fullName: record.serverName,
                data: data,
                type: 'line',
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                itemStyle: {
                    color: colors[index % colors.length],
                },
                lineStyle: {
                    width: 2,
                },
            };
        });

        return {
            backgroundColor: '#fff',
            title: {
                text: config.title,
                textAlign: 'center',
                left: '50%',
                textStyle: {
                    fontSize: 16,
                    fontWeight: 'bold',
                },
            },
            tooltip: {
                trigger: 'axis',
                formatter: (params: any) => {
                    let result = params[0].axisValue + '<br/>';
                    params.forEach((param: any) => {
                        const fullName =
                            param.series?.fullName || param.seriesName;
                        result += `${fullName}: ${param.value}<br/>`;
                    });
                    return result;
                },
            },
            legend: {
                data: series.map((s) => s.name),
                top: 60,
                left: 'center',
                orient: 'horizontal',
                type: 'scroll',
                width: '90%',
                padding: [10, 10, 10, 10],
                itemGap: 15,
                itemWidth: 20,
                itemHeight: 14,
                textStyle: {
                    fontSize: 11,
                    overflow: 'truncate',
                    width: 100,
                },
                formatter: (name: string) => {
                    if (name.length > 15) {
                        return name.substring(0, 12) + '...';
                    }
                    return name;
                },
                tooltip: {
                    show: true,
                },
                pageButtonItemGap: 5,
                pageButtonGap: 30,
                pageButtonPosition: 'end',
                pageFormatter: '{current}/{total}',
                pageIconColor: '#2f4554',
                pageIconInactiveColor: '#aaa',
                pageIconSize: 15,
                pageTextStyle: {
                    color: '#333',
                },
                animationDurationUpdate: 800,
            },
            grid: {
                left: '3%',
                right: '3%',
                bottom: '3%',
                top: 140,
                containLabel: true,
            },
            xAxis: {
                name: '时间',
                nameLocation: 'center',
                nameGap: 30,
                nameTextStyle: {
                    fontWeight: 700,
                },
                type: 'category',
                boundaryGap: false,
                data: sortedHours,
            },
            yAxis: {
                name: '玩家数',
                nameGap: 30,
                nameLocation: 'end',
                nameTextStyle: {
                    fontWeight: 700,
                },
                type: 'value',
                min: 0,
            },
            series: series,
        };
    }

    private async svgToPng(svg: string): Promise<Buffer> {
        const resvg = new Resvg(svg, {
            fitTo: { mode: 'width', value: this.width },
            background: 'white',
        });
        return Buffer.from(resvg.render().asPng());
    }

    private async savePng(buffer: Buffer, fileName: string): Promise<void> {
        const outputPath = path.join(
            process.cwd(),
            OUTPUT_FOLDER,
            `./${fileName}`,
        );

        if (!fs.existsSync(OUTPUT_FOLDER)) {
            fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
        }

        await fs.promises.writeFile(outputPath, buffer);
    }

    private handleRenderError(error: unknown, config: ServerChartConfig): void {
        const wrapped = asImageRenderError(error, {
            code: 'IMAGE_RENDER_FAILED',
            message: `Failed to render server chart: ${config.title}`,
            context: {
                scene: 'ServerChartRenderer',
                fileName: config.outputFile,
            },
        });
        logImageRenderError(wrapped);
        logger.error('ServerChartRenderer failed', wrapped);
    }
}
