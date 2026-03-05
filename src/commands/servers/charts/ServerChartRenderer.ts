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

        const downsampleFactor = xAxisDates.length > 12 ? 2 : 1;
        const downsampleCategory = (labels: string[]): string[] => {
            if (downsampleFactor <= 1) return labels;
            const out: string[] = [];
            for (let i = 0; i < labels.length; i += downsampleFactor) {
                const start = labels[i];
                const end = labels[i + downsampleFactor - 1];
                if (!end || end === start) {
                    out.push(start);
                } else {
                    out.push(`${start}-${end}`);
                }
            }
            return out;
        };

        const downsampleSeriesData = (
            data: Array<number | null>,
        ): Array<number | null> => {
            if (downsampleFactor <= 1) return data;
            const out: Array<number | null> = [];
            for (let i = 0; i < data.length; i += downsampleFactor) {
                let sum = 0;
                let cnt = 0;
                for (let j = 0; j < downsampleFactor; j++) {
                    const v = data[i + j];
                    if (v !== null && v !== undefined) {
                        sum += v;
                        cnt += 1;
                    }
                }
                out.push(cnt > 0 ? Math.round(sum / cnt) : null);
            }
            return out;
        };

        const MAX_SERIES = 10;
        const showRecords = activeRecords.slice(0, MAX_SERIES);
        const hiddenCount = Math.max(
            0,
            activeRecords.length - showRecords.length,
        );
        const showPointLabels = showRecords.length <= 6;

        const xAxisCategories = downsampleCategory(xAxisDates);

        const series = showRecords.map((record, index) => {
            const dataMap = new Map(record.data.map((d) => [d.date, d.count]));
            const rawData = xAxisDates.map((date) => dataMap.get(date) ?? null);
            const data = downsampleSeriesData(rawData);

            const lastValue = data.length > 0 ? data[data.length - 1] : null;
            const showEndLabel = lastValue !== null && lastValue !== undefined;

            return {
                name: record.serverName,
                data,
                type: 'line',
                smooth: 0.35,
                showSymbol: false,
                symbol: 'circle',
                symbolSize: 6,
                label: {
                    show: showPointLabels,
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
                    color: colors[index % colors.length],
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
                    width: 3,
                },
            };
        });

        return {
            backgroundColor: '#fff',
            title: {
                text: config.title,
                textAlign: 'center',
                left: '50%',
                subtext:
                    hiddenCount > 0
                        ? `仅展示在线人数最高的前 ${showRecords.length} 个服务器（其余 ${hiddenCount} 个已隐藏）`
                        : undefined,
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
                bottom: 56,
                top: 80,
                containLabel: true,
            },
            xAxis: {
                name: '时间',
                nameLocation: 'center',
                nameGap: 42,
                nameTextStyle: {
                    fontWeight: 700,
                },
                type: 'category',
                boundaryGap: false,
                axisLabel: {
                    margin: 12,
                    interval: downsampleFactor > 1 ? 0 : 0,
                },
                data: xAxisCategories,
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
        const outputDir = path.join(process.cwd(), OUTPUT_FOLDER);
        const outputPath = path.join(outputDir, `./${fileName}`);

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
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
