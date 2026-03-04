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
        const baselineRecord =
            config.records.reduce<IServerAnalyticsRecord | null>((acc, r) => {
                if (!acc) return r;
                return r.data.length > acc.data.length ? r : acc;
            }, null);

        const xAxisDates = baselineRecord
            ? baselineRecord.data.map((d) => d.date)
            : [];
        const lastDate =
            xAxisDates.length > 0 ? xAxisDates[xAxisDates.length - 1] : null;

        const activeRecords = lastDate
            ? config.records.filter((r) =>
                  r.data.some((d) => d.date === lastDate),
              )
            : config.records;

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

        const series = activeRecords.map((record, index) => {
            const dataMap = new Map(record.data.map((d) => [d.date, d.count]));
            const data = xAxisDates.map((date) => dataMap.get(date) ?? null);

            const lastValue = data.length > 0 ? data[data.length - 1] : null;
            const showEndLabel = lastValue !== null && lastValue !== undefined;

            return {
                name: record.serverName,
                data,
                type: 'line',
                smooth: false,
                showSymbol: false,
                symbol: 'circle',
                symbolSize: 6,
                label: {
                    show: true,
                    position: 'top',
                    fontSize: 10,
                    color: '#333',
                    formatter: (params: { value: number | null }) => {
                        if (
                            params.value === null ||
                            params.value === undefined
                        ) {
                            return '';
                        }
                        return String(params.value);
                    },
                },
                endLabel: {
                    show: showEndLabel,
                    align: 'left',
                    padding: [2, 4],
                    backgroundColor: 'rgba(255,255,255,0.85)',
                    borderRadius: 2,
                    formatter: (params: { seriesName: string }) => {
                        const name = params.seriesName;
                        if (name.length > 32) {
                            return name.substring(0, 29) + '...';
                        }
                        return name;
                    },
                },
                labelLayout: {
                    moveOverlap: 'shiftY',
                    hideOverlap: true,
                },
                emphasis: {
                    focus: 'series',
                },
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
                        result += `${param.seriesName}: ${param.value}<br/>`;
                    });
                    return result;
                },
            },
            legend: {
                show: false,
            },
            grid: {
                left: '3%',
                right: 260,
                bottom: '3%',
                top: 80,
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
                data: xAxisDates,
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
