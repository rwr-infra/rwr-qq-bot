import {
    MsgExecCtx,
    GlobalEnv,
    IRegister,
    MessageEvent,
    ParamsType,
} from '../types';
import {
    AnalyticsCommandRegister,
    MapsCommandRegister,
    ServersCommandRegister,
    WhereIsCommandRegister,
    PlayersCommandRegister,
    ServerAnalyticsCommandRegister,
} from './servers/register';
import { RollCommandRegister } from './roll/register';
import { logger } from '../utils/logger';
import { RemoteService } from '../services/remote.service';
import {
    getCommandParams,
    getFirstCommand,
    parseIgnoreSpace,
} from '../utils/cmd';
import { checkTimeIntervalValid, getStaticHttpPath } from '../utils/cmdreq';
import { FuckCommandRegister } from './fuck/register';
import { SetuCommandRegister } from './setu/register';
import { TouhouCommandRegister } from './touhou/register';
import { WaifuCommandRegister } from './waifu/registers';
import { OnePtCommandRegister } from './1pt/register';
import { NekoCommandRegister } from './neko/register';
import { WebsiteCommandRegister } from './website/register';
import {
    TDollCommandRegister,
    TDollSkinCommandRegister,
} from './tdoll/register';
import {
    QACommandRegister,
    QADefineCommandRegister,
    QADeleteCommandRegister,
} from './qa/register';
import { VersionCommandRegister } from './version/register';
import {
    LogCommandRegister,
    LogSelfRegister,
    Log7CommandRegister,
} from './log/register';
import { AiCommandRegister } from './ai/register';
import { PostgreSQLService } from '../services/postgresql.service';
import { CanvasImgService } from '../services/canvasImg.service';
import { HelpCanvas, type HelpCanvasModel } from './help/canvas/helpCanvas';

const allCommands: IRegister[] = [
    FuckCommandRegister,
    ServersCommandRegister,
    WhereIsCommandRegister,
    AnalyticsCommandRegister,
    ServerAnalyticsCommandRegister,
    MapsCommandRegister,
    PlayersCommandRegister,
    RollCommandRegister,
    SetuCommandRegister,
    TouhouCommandRegister,
    WaifuCommandRegister,
    OnePtCommandRegister,
    NekoCommandRegister,
    WebsiteCommandRegister,
    QACommandRegister,
    QADefineCommandRegister,
    QADeleteCommandRegister,
    VersionCommandRegister,
    LogCommandRegister,
    LogSelfRegister,
    Log7CommandRegister,
    AiCommandRegister,
    TDollCommandRegister,
    TDollSkinCommandRegister,
];

export const initCommands = async (env: GlobalEnv) => {
    const activeCommands = env.ACTIVE_COMMANDS
        ? new Set(env.ACTIVE_COMMANDS)
        : null;

    const filteredCommands = allCommands.filter(
        (cmd) => !activeCommands || activeCommands.has(cmd.name),
    );

    await Promise.all(
        filteredCommands.map(async (cmd) => {
            await cmd.init?.(env);
        }),
    );

    return filteredCommands;
};

const quickReply = async (event: MessageEvent, text: string) => {
    const message = `[CQ:at,qq=${event.user_id}]\n${text}`;
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

    const activeCommands = env.ACTIVE_COMMANDS
        ? new Set(env.ACTIVE_COMMANDS)
        : null;
    const avaliableCommands = allCommands.filter(
        (c) => !activeCommands || activeCommands.has(c.name),
    );

    // help:
    if (firstCommand === 'help' || firstCommand === 'h') {
        const params = parseIgnoreSpace(['#help', '#h'], msg);
        const query = params.keys().next().value;

        const prefix = env.START_MATCH || '#';
        const visibleCommands = avaliableCommands.filter(
            (c) => !c.isAdmin || isAdminUser,
        );

        const outputFile = `help_${event.group_id ? event.group_id : 'private'}_${event.user_id}.png`;

        let model: HelpCanvasModel;
        if (query) {
            const hitCommand = visibleCommands.find(
                (c) => c.name === query || c.alias === query,
            );
            if (hitCommand) {
                model = {
                    mode: 'detail',
                    prefix,
                    name: hitCommand.name,
                    alias: hitCommand.alias,
                    description: hitCommand.description,
                    hints: hitCommand.hint ?? [],
                };
            } else {
                model = { mode: 'not_found', prefix, query };
            }
        } else {
            model = {
                mode: 'list',
                prefix,
                items: visibleCommands.map((c) => ({
                    name: c.name,
                    alias: c.alias,
                    description: c.description,
                })),
            };
        }

        let fallbackText = '';
        try {
            if (env.OUTPUT_BG_IMG) {
                await CanvasImgService.getInstance().addImg(
                    env.OUTPUT_BG_IMG,
                    true,
                );
            }
            await new HelpCanvas(model, outputFile).render();
            const cqOutput = `[CQ:image,file=${getStaticHttpPath(
                env,
                outputFile,
            )},cache=0,c=8]`;
            await quickReply(event, cqOutput);
        } catch (err) {
            logger.error('[help] render failed', err);

            if (query) {
                const hitCommand = visibleCommands.find(
                    (c) => c.name === query || c.alias === query,
                );
                if (hitCommand) {
                    fallbackText = `${prefix}${hitCommand.name}${hitCommand.alias ? `(${hitCommand.alias})` : ''}: 帮助列表\n\n`;
                    hitCommand.hint?.forEach((h) => {
                        fallbackText += `${h}\n\n`;
                    });
                } else {
                    fallbackText = '未找到对应命令\n';
                }
            } else {
                fallbackText = '帮助列表: \n';
                visibleCommands.forEach((c) => {
                    fallbackText += `${prefix}${c.name}${c.alias ? `(${c.alias})` : ''}: ${c.description}\n\n`;
                });
            }

            await quickReply(event, fallbackText);
        }
        return;
    }

    const hitCommand = avaliableCommands.find(
        (c) => c.name === firstCommand || c.alias === firstCommand,
    );
    if (!hitCommand) {
        return;
    }

    if (hitCommand.isAdmin && !isAdminUser) {
        return;
    }

    if (firstCommand === hitCommand.name || firstCommand === hitCommand.alias) {
        const params: ParamsType = hitCommand.parseParams
            ? hitCommand.parseParams(msg)
            : getCommandParams(msg, hitCommand.defaultParams);
        const ctx: MsgExecCtx = {
            msg,
            env,
            event,
            params,
            reply: async (msg: string) => {
                await quickReply(event, msg);
            },
        };

        if (handlingRequestSet.has(event.user_id)) {
            return;
        }
        handlingRequestSet.add(event.user_id);

        try {
            const cdRes = checkTimeIntervalValid(hitCommand, event);
            if (!cdRes.success) {
                return;
            }

            await hitCommand.exec(ctx);
        } catch (e) {
            logger.error(e);
        } finally {
            handlingRequestSet.delete(event.user_id);
        }
    }
};
