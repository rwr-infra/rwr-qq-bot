import { CronJob } from 'cron';
import { GlobalEnv } from '../../../types';
import { countTotalPlayers, queryAllServers } from '../utils/utils';
import { logger } from '../../../utils/logger';
import { IAnalysisData } from '../types/types';
import { ANALYSIS_DATA_FILE } from '../types/constants';
import { readAnalyticsJson, writeAnalyticsJson } from '../utils/analyticsStore';

export class AnalysticsTask {
    // 10 分钟更新一次
    // static readonly timesInterval = 60 * 1000;
    static readonly timesInterval = '0 */10 * * * *';
    static job: null | CronJob = null;

    static isRunning = false;
    static isUpdating = false;

    static write(data: IAnalysisData) {
        const recordValue =
            readAnalyticsJson<IAnalysisData[]>(ANALYSIS_DATA_FILE) ?? [];

        // 统计最近 7 天 数据, 检查日期是否已经存在
        const isFoundTodayValue = recordValue.find((v) => v.date === data.date);

        // 若存在本日数据, 取最高值
        if (isFoundTodayValue) {
            if (data.count > isFoundTodayValue.count) {
                isFoundTodayValue.count = data.count;
            }
            // 不存在本日数据, 仅做长度判断
        } else {
            recordValue.push(data);
            if (recordValue.length > 7) {
                recordValue.shift();
            }
        }

        writeAnalyticsJson(ANALYSIS_DATA_FILE, recordValue);
    }

    static async updateCount(env: GlobalEnv) {
        logger.info('AnalysticsTask::updateCount(): start');
        if (AnalysticsTask.isUpdating) {
            return;
        }
        AnalysticsTask.isUpdating = true;
        try {
            const serverList = await queryAllServers(env.SERVERS_MATCH_REGEX);
            const playersCount = countTotalPlayers(serverList);

            const date = new Date();
            const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
            logger.info('AnalysticsTask updateCount', dateStr, playersCount);
            AnalysticsTask.write({
                date: dateStr,
                count: playersCount,
            });
        } catch (e) {
            logger.error('AnalysticsTask updateCount error', e);
        }

        AnalysticsTask.isUpdating = false;
        logger.info('AnalysticsTask updateCount:: completed');
    }

    static start(env: GlobalEnv) {
        logger.info('AnalysticsTask::start()');
        if (this.isRunning) {
            return;
        }
        // 立刻置位, 保证 start() 幂等(避免首个 tick 前重复 start 注册多个 CronJob)
        this.isRunning = true;
        // 立即调用一次
        AnalysticsTask.updateCount(env);

        AnalysticsTask.job = new CronJob(
            AnalysticsTask.timesInterval,
            () => {
                AnalysticsTask.isRunning = true;
                AnalysticsTask.updateCount(env);
            },
            null,
            true,
            'Asia/Shanghai'
        );
    }
}
