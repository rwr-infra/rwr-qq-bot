/**
 * ServerCommandFactory - Creates server commands with shared infrastructure
 *
 * Eliminates duplicate code across server commands by providing:
 * - Common initialization logic
 * - Shared canvas rendering setup
 * - Standardized reply formatting
 */

import { logger } from '../../../utils/logger';
import { GlobalEnv, MsgExecCtx } from '../../../types';
import { getStaticHttpPath } from '../../../utils/cmdreq';
import { CanvasImgService } from '../../../services/canvasImg.service';

export interface ServerCommandConfig {
    name: string;
    alias: string;
    description: string;
    hint: string[];
    isAdmin?: boolean;
    timesInterval: number;
    outputFile: string;
}

export interface ServerCommandContext {
    env: GlobalEnv;
    ctx: MsgExecCtx;
    reply: (message: string) => Promise<void>;
}

export interface RenderResult {
    fileName: string;
    serverCount: number;
}

export type RenderFunction = (
    env: GlobalEnv,
) => Promise<RenderResult> | RenderResult;

/**
 * Factory function to create server commands with shared infrastructure
 */
export function createServerCommand(
    config: ServerCommandConfig,
    renderFn: RenderFunction,
) {
    return {
        name: config.name,
        alias: config.alias,
        description: config.description,
        hint: config.hint,
        isAdmin: config.isAdmin ?? false,
        timesInterval: config.timesInterval,

        init: async (env: GlobalEnv): Promise<void> => {
            // Initialize canvas background image if configured
            if (env.OUTPUT_BG_IMG) {
                logger.info(
                    `[${config.name}] Initializing canvas with background image`,
                );
                await CanvasImgService.getInstance().addImg(
                    env.OUTPUT_BG_IMG,
                    true,
                );
            }
        },

        exec: async (ctx: MsgExecCtx): Promise<void> => {
            logger.info(`[${config.name}] Executing command`);

            try {
                // Execute render function
                const result = await Promise.resolve(renderFn(ctx.env));

                // Format reply with image
                const imageUrl = getStaticHttpPath(ctx.env, result.fileName);
                let cqOutput = `[CQ:image,file=${imageUrl},cache=0,c=8]`;

                // Add fallback message if no servers found
                if (result.serverCount === 0 && ctx.env.SERVERS_FALLBACK_URL) {
                    cqOutput += `\n检测到当前服务器列表为空, 请尝试使用备用查询地址: ${ctx.env.SERVERS_FALLBACK_URL}`;
                }

                await ctx.reply(cqOutput);
                logger.info(`[${config.name}] Command executed successfully`);
            } catch (error) {
                logger.error(
                    `[${config.name}] Command execution failed:`,
                    error,
                );
                throw error;
            }
        },
    };
}

/**
 * Helper to format server count for display
 */
export function formatServerCount(count: number): string {
    if (count === 0) {
        return '暂无服务器';
    }
    return `${count} 个服务器`;
}

/**
 * Helper to create standardized CQ image tag
 */
export function createCQImageTag(
    env: GlobalEnv,
    fileName: string,
    options?: { cache?: number; c?: number },
): string {
    const imageUrl = getStaticHttpPath(env, fileName);
    const cache = options?.cache ?? 0;
    const c = options?.c ?? 8;
    return `[CQ:image,file=${imageUrl},cache=${cache},c=${c}]`;
}
