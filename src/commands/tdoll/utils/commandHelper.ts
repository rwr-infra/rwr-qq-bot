import { ParamsType } from '../../../types';
import { TDollSvc } from '../services/tdoll.service';
import { TDollSkinSvc } from '../services/tdollskin.service';
import { logger } from '../../../utils/logger';
import {
    getMatchedTDollData,
    getMatchedTDollDataWithCategory,
    printTDollDetailPng,
    printTDollListPng,
} from './utils';
import {
    buildUserScopedPngName,
    getStaticHttpPath,
} from '../../../utils/cmdreq';
import { ITDollDataItem } from '../types/types';

/** 多结果时的可操作提示尾行 */
export const MULTI_RESULT_TAIL = '输入 #ts <武器ID> 查看详情与皮肤';

/** 单结果时的可复制信息尾行 */
export const buildSingleResultTail = (tdoll: ITDollDataItem): string =>
    `No.${tdoll.id} ${tdoll.nameIngame} ${tdoll.type} | 皮肤查询: #ts ${tdoll.id}`;

const cqImage = (env: any, fileName: string): string =>
    `[CQ:image,file=${getStaticHttpPath(env, fileName)},cache=0,c=8]`;

export class CommandHelper {
    /**
     * 获取查询参数
     * @param params 参数对象
     * @returns 参数数组
     */
    static getQueryParams(params: ParamsType): string[] {
        return Array.from(params.keys()).map(String);
    }

    /**
     * 验证参数数量
     * @param ctx 上下文对象
     * @param min 最小参数数量
     * @param max 最大参数数量
     * @returns 是否验证通过
     */
    static async validateParams(
        ctx: any,
        min: number,
        max?: number
    ): Promise<boolean> {
        const paramCount = ctx.params.size;
        if (paramCount < min || (max && paramCount > max)) {
            return false;
        }
        return true;
    }

    /**
     * 处理错误
     * @param ctx 上下文对象
     * @param error 错误对象
     * @param commandName 命令名称
     */
    static async handleError(
        ctx: any,
        error: any,
        commandName: string
    ): Promise<void> {
        logger.error(`${commandName} command error`, { error, ctx });
        await ctx.reply('查询失败，请稍后重试');
    }

    /**
     * 获取 TDoll 查询回复:
     * - 单结果 → 数据卡 + 皮肤网格合并图 + 可复制信息尾行
     * - 多结果 → 自适应双列卡片列表图(展示全部匹配结果) + 提示尾行
     */
    static async getTDoll2Reply(
        ctx: any,
        query: string,
        query2?: string
    ): Promise<string | null> {
        const tdollData = await TDollSvc.getData();

        const matchedResults = this.findMatchingTDolls(
            tdollData,
            query,
            query2
        );
        if (!matchedResults.length) {
            return '未找到指定枪名，请检查输入是否有误！';
        }

        // 按 群/用户 命名, 避免并发覆盖
        const fileName = buildUserScopedPngName('tdoll', ctx.event);

        if (matchedResults.length === 1) {
            const tdoll = matchedResults[0];
            const skinRecord = await TDollSkinSvc.getData();
            await printTDollDetailPng(
                tdoll.id,
                tdollData,
                skinRecord,
                fileName
            );
            return `${cqImage(ctx.env, fileName)}\n${buildSingleResultTail(tdoll)}`;
        }

        await printTDollListPng(query, matchedResults, fileName);
        return `${cqImage(ctx.env, fileName)}\n${MULTI_RESULT_TAIL}`;
    }

    /**
     * 查找匹配的战术人形数据
     */
    private static findMatchingTDolls(
        tdollData: ITDollDataItem[],
        query: string,
        query2?: string
    ): ITDollDataItem[] {
        return query2
            ? getMatchedTDollDataWithCategory(tdollData, query, query2)
            : getMatchedTDollData(tdollData, query);
    }
}
