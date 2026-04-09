import Fastify from 'fastify';
import path from 'path';
import fastifyStatic from '@fastify/static';
import { logger } from './utils/logger';
import { RemoteService } from './services/remote.service';
import { initCommands } from './commands';
import { registerRoutes } from './routes';
import { gracefulShutdown } from './shutdown';
import { loadEnv } from './utils/env';
import { getDirname } from './utils/esm';
import { CanvasImgService } from './services/canvasImg.service';

// 创建一个启动函数
async function startServer() {
    const __dirname = getDirname(import.meta.url);

    const app = Fastify({
        logger: {
            serializers: {
                res(res) {
                    return {
                        type: 'access:response',
                        method: res.request?.method,
                        url: res.request?.url,
                        params: res.request?.params,
                        hostname: res.request?.hostname,
                        ip: res.request?.ip,
                        elapse: res.elapsedTime,
                        statusCode: res.statusCode,
                    };
                },
                req(req) {
                    return {
                        type: 'access:request',
                        method: req.method,
                        url: req.url,
                        params: req.params,
                        hostname: req.hostname,
                        ip: req.ip,
                        body: req.body,
                    };
                },
            },
        },
    });

    app.register(fastifyStatic, {
        root: path.join(__dirname, '../out'),
        prefix: '/out/',
    });

    const env = loadEnv();

    if (env.OUTPUT_BG_IMG) {
        await CanvasImgService.getInstance().addImg(env.OUTPUT_BG_IMG, true);
    }

    RemoteService.init(env);

    registerRoutes(app, env);

    const address = await app.listen({
        host: env.HOSTNAME,
        port: env.PORT,
    });

    logger.info('initing Commands...', env);
    await initCommands(env);
    logger.info(`App listening on ${address}`);

    // 注册优雅停机的信号处理
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    signals.forEach((signal) => {
        process.on(signal, () => gracefulShutdown(app, signal));
    });

    // 处理未捕获的异常
    process.on('uncaughtException', (error) => {
        logger.error('Uncaught Exception:', error);
        gracefulShutdown(app, 'uncaughtException');
    });

    // 处理未处理的 Promise 拒绝
    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    return app;
}

// 启动服务器
startServer().catch((err) => {
    logger.error('Failed to start server:', err);
    process.exit(1);
});
