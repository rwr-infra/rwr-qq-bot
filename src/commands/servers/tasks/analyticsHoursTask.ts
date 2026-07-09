import { CronJob } from 'cron';
import { GlobalEnv } from '../../../types';
import { countTotalPlayers, queryAllServers } from '../utils/utils';
import { logger } from '../../../utils/logger';
import { IAnalysisData } from '../types/types';
import { ANALYSIS_HOURS_DATA_FILE } from '../types/constants';
import { readAnalyticsJson, writeAnalyticsJson } from '../utils/analyticsStore';

export class AnalysticsHoursTask {
    // 2 分钟更新一次
    // static readonly timesInterval = 2 * 60 * 1000;
    static readonly timesInterval = '0 */2 * * * *';
    static job: null | CronJob = null;

    static isRunning = false;
    static isUpdating = false;

    static write(data: IAnalysisData) {
        const recordValue =
            readAnalyticsJson<IAnalysisData[]>(ANALYSIS_HOURS_DATA_FILE) ?? [];

        let newRecordValue = recordValue;
        const lastValue =
            recordValue.length === 0
                ? null
                : recordValue[recordValue.length - 1];

        // 最后一项为当前时间
        if (lastValue && lastValue.date === data.date) {
            // 且统计 < 当前统计, 则更新
            if (lastValue.count < data.count) {
                newRecordValue = [...recordValue.slice(0, -1), data];
            }
        } else if (recordValue.length === 24) {
            newRecordValue = [...recordValue.slice(1), data];
        } else {
            newRecordValue = [...recordValue, data];
        }

        writeAnalyticsJson(ANALYSIS_HOURS_DATA_FILE, newRecordValue);
    }

    static async updateCount(env: GlobalEnv) {
        logger.info('AnalysticsHoursTask::updateCount(): start');
        if (AnalysticsHoursTask.isUpdating) {
            return;
        }
        AnalysticsHoursTask.isUpdating = true;
        try {
            const serverList = await queryAllServers(env.SERVERS_MATCH_REGEX);
            const playersCount = countTotalPlayers(serverList);

            const date = new Date();
            const dateStr = `${date.getHours()}时`;
            logger.info(
                'AnalysticsHoursTask updateCount',
                dateStr,
                playersCount
            );
            AnalysticsHoursTask.write({
                date: dateStr,
                count: playersCount,
            });
        } catch (e) {
            logger.error('AnalysticsHoursTask updateCount error', e);
        }

        AnalysticsHoursTask.isUpdating = false;
        logger.info('AnalysticsHoursTask updateCount:: completed');
    }

    static start(env: GlobalEnv) {
        logger.info('AnalysticsHoursTask::start()');
        if (this.isRunning) {
            return;
        }
        // 立刻置位, 保证 start() 幂等(避免首个 tick 前重复 start 注册多个 CronJob)
        this.isRunning = true;
        // 立即调用一次
        AnalysticsHoursTask.updateCount(env);

        AnalysticsHoursTask.job = new CronJob(
            AnalysticsHoursTask.timesInterval,
            () => {
                AnalysticsHoursTask.isRunning = true;
                AnalysticsHoursTask.updateCount(env);
            },
            null,
            true,
            'Asia/Shanghai'
        );
    }
}
