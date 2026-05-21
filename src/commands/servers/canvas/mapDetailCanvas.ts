import { createCanvas, Canvas2DContext } from '../../../services/canvasBackend';
import { HistoricalServerItem, IMapDataItem, OnlineServerItem } from '../types/types';
import {
    calcCanvasTextWidth,
    getCountColor,
    getServerInfoDisplaySectionText,
    getMapShortName,
} from '../utils/utils';
import { BaseCanvas } from '../../../services/baseCanvas';

const HISTORY_LINE_HEIGHT = 30;

export class MapDetailCanvas extends BaseCanvas {
    map: IMapDataItem;
    servers: OnlineServerItem[];
    historicalServers: HistoricalServerItem[];
    fileName: string;

    renderWidth = 0;
    renderHeight = 0;

    totalTitle = '';
    maxRectWidth = 0;
    contentLines = 0;

    constructor(
        map: IMapDataItem,
        servers: OnlineServerItem[],
        historicalServers: HistoricalServerItem[],
        fileName: string,
    ) {
        super();
        this.map = map;
        this.servers = servers;
        this.historicalServers = historicalServers;
        this.fileName = fileName;
    }

    measure() {
        const title = `地图详情: ${this.map.name} (${this.map.id})`;
        this.totalTitle = title;

        const titleWidth = calcCanvasTextWidth(title, 20) + 40;

        this.maxRectWidth = titleWidth;

        this.contentLines = 1;

        if (this.servers.length === 0) {
            const noServerText = '当前没有服务器正在运行此地图';
            const noServerWidth = calcCanvasTextWidth(noServerText, 16) + 40;
            if (noServerWidth > this.maxRectWidth) {
                this.maxRectWidth = noServerWidth;
            }
            this.contentLines += 1;
        } else {
            for (const s of this.servers) {
                const status =
                    s.current_players === s.max_players ? '已满' : '在线';
                const line = `${s.name}  | ${s.current_players}/${s.max_players} 玩家 | ${status}`;
                const lineWidth = calcCanvasTextWidth(line, 16) + 80;
                if (lineWidth > this.maxRectWidth) {
                    this.maxRectWidth = lineWidth;
                }
                this.contentLines += 1;
            }
        }

        const summaryText = `共 ${this.servers.length} 个服务器正在运行此地图`;
        const summaryWidth = calcCanvasTextWidth(summaryText, 16) + 40;
        if (summaryWidth > this.maxRectWidth) {
            this.maxRectWidth = summaryWidth;
        }
        this.contentLines += 1;

        if (this.historicalServers.length > 0) {
            this.contentLines += 1;
            const titleWidth = calcCanvasTextWidth('近5分钟离线服务器', 14) + 40;
            if (titleWidth > this.maxRectWidth) {
                this.maxRectWidth = titleWidth;
            }
            for (const s of this.historicalServers) {
                const line = `${s.name}  | ${s.current_players}/${s.max_players} 玩家 | 离线  5分钟前`;
                const lineWidth = calcCanvasTextWidth(line, 16) + 80;
                if (lineWidth > this.maxRectWidth) {
                    this.maxRectWidth = lineWidth;
                }
                this.contentLines += 1;
            }
        }

        this.renderHeight = 80 + this.contentLines * 40 + 40;
        this.renderWidth = this.maxRectWidth;
    }

    renderLayout(context: Canvas2DContext, width: number, height: number) {
        context.fillStyle = '#451a03';
        context.fillRect(0, 0, width, height);
    }

    renderTitle(context: Canvas2DContext) {
        context.font = 'bold 20pt Consolas';
        context.textAlign = 'left';
        context.textBaseline = 'top';
        context.fillStyle = '#fff';
        context.fillText(this.totalTitle, 10, 10);

        this.renderStartY = 10 + 40 + 10;

        context.strokeStyle = '#f48225';
        context.beginPath();
        context.moveTo(10, this.renderStartY);
        context.lineTo(this.renderWidth - 10, this.renderStartY);
        context.stroke();

        this.renderStartY += 10;
    }

    renderServerList(context: Canvas2DContext) {
        context.font = '16pt Consolas';
        context.textAlign = 'left';
        context.textBaseline = 'top';

        if (this.servers.length === 0) {
            context.fillStyle = '#9ca3af';
            context.fillText(
                '当前没有服务器正在运行此地图',
                20,
                this.renderStartY,
            );
            this.renderStartY += 40;
        } else {
            for (const s of this.servers) {
                const status =
                    s.current_players === s.max_players ? '已满' : '在线';

                context.fillStyle = '#bfdbfe';
                context.fillText(s.name, 20, this.renderStartY);

                const nameWidth = context.measureText(s.name).width;

                context.fillStyle = getCountColor(
                    s.current_players,
                    s.max_players,
                );
                const playersText = `  | ${s.current_players}/${s.max_players} 玩家`;
                context.fillText(
                    playersText,
                    20 + nameWidth,
                    this.renderStartY,
                );

                const playersWidth = context.measureText(playersText).width;
                context.fillStyle =
                    status === '已满' ? '#ef4444' : '#22c55e';
                context.fillText(
                    ` | ${status}`,
                    20 + nameWidth + playersWidth,
                    this.renderStartY,
                );

                this.renderStartY += 40;
            }
        }

        context.strokeStyle = '#f48225';
        context.beginPath();
        context.moveTo(10, this.renderStartY);
        context.lineTo(this.renderWidth - 10, this.renderStartY);
        context.stroke();
        this.renderStartY += 10;

        context.fillStyle = '#9ca3af';
        context.font = '14pt Consolas';
        context.fillText(
            `共 ${this.servers.length} 个服务器正在运行此地图`,
            20,
            this.renderStartY,
        );
        this.renderStartY += 40;
    }

    renderHistoricalList(context: Canvas2DContext) {
        if (this.historicalServers.length === 0) {
            return;
        }

        context.strokeStyle = '#f48225';
        context.beginPath();
        context.moveTo(10, this.renderStartY);
        context.lineTo(this.renderWidth - 10, this.renderStartY);
        context.stroke();
        this.renderStartY += 10;

        context.font = 'bold 14pt Consolas';
        context.textAlign = 'left';
        context.textBaseline = 'top';
        context.fillStyle = '#9ca3af';
        context.fillText('近5分钟离线服务器', 20, this.renderStartY);
        this.renderStartY += 40;

        context.font = '16pt Consolas';

        this.historicalServers.forEach((s) => {
            context.fillStyle = '#6b7280';
            context.fillText(s.name, 20, this.renderStartY);

            const nameWidth = context.measureText(s.name).width;

            context.fillStyle = '#9ca3af';
            const playersText = `  | ${s.current_players}/${s.max_players} 玩家`;
            context.fillText(playersText, 20 + nameWidth, this.renderStartY);

            const playersWidth = context.measureText(playersText).width;
            context.fillStyle = '#9ca3af';
            const statusText = ` | 离线`;
            context.fillText(
                statusText,
                20 + nameWidth + playersWidth,
                this.renderStartY,
            );

            const statusWidth = context.measureText(statusText).width;
            const elapsedMin = Math.ceil((Date.now() - s.lastSeenAt) / 60000);
            context.font = '12pt Consolas';
            const yOffset = 8 / 3;
            context.fillText(
                `  ${elapsedMin}分钟前`,
                20 + nameWidth + playersWidth + statusWidth,
                this.renderStartY + yOffset,
            );

            context.font = '16pt Consolas';
            this.renderStartY += HISTORY_LINE_HEIGHT;
        });
    }

    render() {
        this.record();
        this.measure();

        const canvas = createCanvas(this.renderWidth, this.renderHeight);
        const context = canvas.getContext('2d');

        this.renderLayout(context, this.renderWidth, this.renderHeight);
        this.renderBgImg(context, this.renderWidth, this.renderHeight);
        this.renderTitle(context);
        this.renderServerList(context);
        this.renderHistoricalList(context);
        this.renderFooter(context);

        return super.writeFile(canvas, this.fileName);
    }
}
