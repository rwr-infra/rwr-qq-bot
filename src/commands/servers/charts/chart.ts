/**
 * 重构后的图表模块
 * 使用 ChartRenderer 类消除重复代码
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    ANALYSIS_DATA_FILE,
    ANALYSIS_HOURS_DATA_FILE,
    ANALYSIS_HOURS_OUTPUT_FILE,
    ANALYSIS_OUTPUT_FILE,
    ANALYSIS_SERVER_DATA_FILE,
    ANALYSIS_SERVER_OUTPUT_FILE,
    OUTPUT_FOLDER,
} from '../types/constants';
import { IAnalysisData, IServerAnalyticsRecord } from '../types/types';
import { ChartRenderer, ChartConfig } from './ChartRenderer';
import { ServerChartRenderer } from './ServerChartRenderer';

/**
 * 读取 7 日统计数据
 */
const readData = (): Array<{ date: string; count: number }> => {
    const fileContent = fs.readFileSync(
        path.join(process.cwd(), OUTPUT_FOLDER, `./${ANALYSIS_DATA_FILE}`),
        'utf-8',
    );

    const typedValues = JSON.parse(fileContent) as IAnalysisData[];

    return typedValues.map((v) => ({
        date: v.date,
        count: v.count,
    }));
};

/**
 * 读取 24 小时统计数据
 */
const readHoursData = (): Array<{ date: string; count: number }> => {
    const fileContent = fs.readFileSync(
        path.join(
            process.cwd(),
            OUTPUT_FOLDER,
            `./${ANALYSIS_HOURS_DATA_FILE}`,
        ),
        'utf-8',
    );

    const typedValues = JSON.parse(fileContent) as IAnalysisData[];

    return typedValues.map((v) => ({
        date: v.date,
        count: v.count,
    }));
};

/**
 * 渲染 7 日统计图表
 * 使用 ChartRenderer 统一渲染逻辑
 */
export const printChartPng = async (): Promise<string> => {
    const renderer = new ChartRenderer();

    const config: ChartConfig = {
        title: '玩家7日在线数峰值统计图',
        xAxisName: '日期',
        yAxisName: '玩家数',
        data: readData(),
        outputFile: ANALYSIS_OUTPUT_FILE,
    };

    return renderer.render(config);
};

/**
 * 渲染 24 小时统计图表
 * 使用 ChartRenderer 统一渲染逻辑
 */
export const printHoursChartPng = async (): Promise<string> => {
    const renderer = new ChartRenderer();

    const config: ChartConfig = {
        title: '玩家24小时在线数峰值统计图',
        xAxisName: '日期',
        yAxisName: '玩家数',
        data: readHoursData(),
        outputFile: ANALYSIS_HOURS_OUTPUT_FILE,
    };

    return renderer.render(config);
};

/**
 * 读取服务器统计数据
 */
const readServerData = (): IServerAnalyticsRecord[] => {
    const filePath = path.join(
        process.cwd(),
        OUTPUT_FOLDER,
        `./${ANALYSIS_SERVER_DATA_FILE}`,
    );

    if (!fs.existsSync(filePath)) {
        return [];
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');

    const typedValues = JSON.parse(fileContent) as {
        records: IServerAnalyticsRecord[];
    };

    return typedValues.records || [];
};

/**
 * 渲染服务器统计图表
 */
export const printServerChartPng = async (): Promise<string> => {
    const renderer = new ServerChartRenderer();

    const records = readServerData();

    if (records.length === 0) {
        throw new Error('服务器统计数据尚未生成，请稍后再试');
    }

    return renderer.render({
        title: '各服务器24小时在线玩家数统计图',
        records: records,
        outputFile: ANALYSIS_SERVER_OUTPUT_FILE,
    });
};
