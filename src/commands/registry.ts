import { GlobalEnv, IRegister } from '../types';
import {
    AnalyticsCommandRegister,
    MapsCommandRegister,
    ServersCommandRegister,
    WhereIsCommandRegister,
    PlayersCommandRegister,
    ServerOverviewCommandRegister,
} from './servers/register';
import { RollCommandRegister } from './roll/register';
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
import { CheckCommandRegister } from './check/register';
import { HelpCommandRegister } from './help/register';

/**
 * 命令注册总表。help 也是一个普通 IRegister——与其它命令走完全相同的
 * 查找 / 冷却 / 执行 / 日志 通道，不再由 msgHandler 特判。
 */
export const allCommands: IRegister[] = [
    FuckCommandRegister,
    ServersCommandRegister,
    WhereIsCommandRegister,
    AnalyticsCommandRegister,
    ServerOverviewCommandRegister,
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
    CheckCommandRegister,
    HelpCommandRegister,
];

/**
 * 按 ACTIVE_COMMANDS 过滤出启用的命令(留空则全部启用)。
 * initCommands 与 msgHandler 共用，避免两处各自维护同一过滤逻辑。
 */
export const resolveActiveCommands = (env: GlobalEnv): IRegister[] => {
    const activeCommands = env.ACTIVE_COMMANDS
        ? new Set(env.ACTIVE_COMMANDS)
        : null;
    return allCommands.filter(
        (cmd) => !activeCommands || activeCommands.has(cmd.name),
    );
};
