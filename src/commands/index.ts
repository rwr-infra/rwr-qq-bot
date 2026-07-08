import {
    MsgExecCtx,
    GlobalEnv,
    IRegister,
    MessageEvent,
    ParamsType,
} from '../types';
import { logger } from '../utils/logger';
import { RemoteService } from '../services/remote.service';
import { getCommandParams, getFirstCommand } from '../utils/cmd';
import { checkTimeIntervalValid } from '../utils/cmdreq';
import { PostgreSQLService, CmdData } from '../services/postgresql.service';
import { resolveActiveCommands } from './registry';

export const initCommands = async (env: GlobalEnv) => {
    const filteredCommands = resolveActiveCommands(env);

    await Promise.all(
        filteredCommands.map(async (cmd) => {
            await cmd.init?.(env);
        }),
    );

    return filteredCommands;
};

const quickReply = async (event: MessageEvent, text: string) => {
    const message = text.includes('[CQ:at,qq=')
        ? text
        : `[CQ:at,qq=${event.user_id}]\n${text}`;
    if (event.group_id) {
        await RemoteService.getInst().sendGroupMsg({
            group_id: event.group_id,
            message,
        });
    } else {
        await RemoteService.getInst().sendPrivateMsg({
            user_id: event.user_id,
            message: text,
        });
    }
};

const handlingRequestSet = new Set<number>();

const formatCooldownSeconds = (remainingMs?: number) => {
    if (!remainingMs || remainingMs <= 0) {
        return 1;
    }

    return Math.ceil(remainingMs / 1000);
};

/**
 * 记录命令执行数据到 PostgreSQL(可选; 未配置或失败都不影响主流程)。
 */
const logCommandExecution = async (
    env: GlobalEnv,
    hitCommand: IRegister,
    params: ParamsType,
    event: MessageEvent,
    receivedTime: Date,
    responseTime: Date | undefined,
): Promise<void> => {
    if (!(env.PG_HOST && env.PG_DB && env.PG_USER)) {
        return;
    }

    try {
        const elapseTime = responseTime
            ? responseTime.getTime() - receivedTime.getTime()
            : 0;
        const cmdData: CmdData = {
            cmd: hitCommand.name,
            params: Array.from(params.keys()).join(' '),
            user_id: event.user_id,
            group_id: event.group_id || 0,
            received_time: receivedTime,
            response_time: responseTime,
            elapse_time: elapseTime,
        };
        await PostgreSQLService.getInst().insertCmdData(cmdData);
    } catch (dbError) {
        // 数据记录失败不影响主流程，仅记录日志
        logger.error('[cmd] Failed to insert cmd data', dbError);
    }
};

export const msgHandler = async (env: GlobalEnv, event: MessageEvent) => {
    const msgRaw = event.message;
    if (typeof msgRaw !== 'string') {
        return;
    }
    const msg = msgRaw.trim();

    if (!msg.startsWith(env.START_MATCH)) {
        return;
    }
    const listenGroup = Number(env.LISTEN_GROUP);
    if (event.group_id && event.group_id !== listenGroup) {
        return;
    }

    logger.info('> MessageEvent', event);
    logger.info('> Got bot msg', msg);

    const firstCommand = getFirstCommand(msg);
    const isAdminUser = env.ADMIN_QQ_LIST.some((qq) => event.user_id === qq);
    const avaliableCommands = resolveActiveCommands(env);

    const hitCommand = avaliableCommands.find(
        (c) => c.name === firstCommand || c.alias === firstCommand,
    );
    if (!hitCommand) {
        return;
    }

    if (hitCommand.isAdmin && !isAdminUser) {
        return;
    }

    const params: ParamsType = hitCommand.parseParams
        ? hitCommand.parseParams(msg)
        : getCommandParams(msg, hitCommand.defaultParams);
    const ctx: MsgExecCtx = {
        msg,
        env,
        event,
        params,
        reply: async (replyMsg: string) => {
            await quickReply(event, replyMsg);
        },
    };

    const cdRes = checkTimeIntervalValid(hitCommand, event);
    if (!cdRes.success) {
        await ctx.reply(
            `命令冷却中，请 ${formatCooldownSeconds(cdRes.remainingMs)} 秒后再试`,
        );
        return;
    }

    if (handlingRequestSet.has(event.user_id)) {
        await ctx.reply('上一条命令仍在处理中，请稍后再试');
        return;
    }
    handlingRequestSet.add(event.user_id);

    const receivedTime = new Date();
    let responseTime: Date | undefined;

    try {
        await hitCommand.exec(ctx);
        responseTime = new Date();
    } catch (e) {
        logger.error(e);
        responseTime = new Date();
    } finally {
        handlingRequestSet.delete(event.user_id);
        await logCommandExecution(
            env,
            hitCommand,
            params,
            event,
            receivedTime,
            responseTime,
        );
    }
};
