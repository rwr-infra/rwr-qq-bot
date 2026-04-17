import { createCanvas, Canvas2DContext } from '../../../services/canvasBackend';
import { HistoricalServerItem, OnlineServerItem } from '../types/types';
import {
    getServersHeaderDisplaySectionText,
    calcCanvasTextWidth,
    getServerInfoDisplaySectionText,
    getCountColor,
} from '../utils/utils';
import { BaseCanvas } from '../../../services/baseCanvas';

const HISTORY_LINE_HEIGHT = 30;
const HISTORY_SECTION_TITLE = '近5分钟离线服务器';

export class ServersCanvas extends BaseCanvas {
    serverList: OnlineServerItem[];
    historicalServers: HistoricalServerItem[];
    fileName: string;

    measureMaxWidth = 0;
    renderWidth = 0;
    renderHeight = 0;

    titleData: ReturnType<typeof getServersHeaderDisplaySectionText> = {
        serversTotalSection: '',
        playersTotalStaticSection: '',
        playersCountSection: '',
    };
    totalTitle = '';

    maxLengthStr = '';
    renderStartY = 0;
    maxRectWidth = 0;
    contentLines = 0;

    totalFooter = '';

    constructor(
        serverList: OnlineServerItem[],
        historicalServers: HistoricalServerItem[],
        fileName: string,
    ) {
        super();
        this.serverList = serverList;
        this.historicalServers = historicalServers;
        this.fileName = fileName;
    }

    measureTitle() {
        const titleData = getServersHeaderDisplaySectionText(this.serverList);
        this.titleData = titleData;

        this.totalTitle =
            titleData.serversTotalSection +
            titleData.playersTotalStaticSection +
            titleData.playersCountSection;

        const titleWidth = calcCanvasTextWidth(this.totalTitle, 20) + 20;
        if (titleWidth > this.measureMaxWidth) {
            this.measureMaxWidth = titleWidth;
        }
    }

    measureList() {
        this.maxLengthStr = '';
        this.serverList.forEach((s) => {
            this.contentLines += 1;
            const sectionData = getServerInfoDisplaySectionText(s);
            const outputText =
                sectionData.serverSection + sectionData.playersSection;
            if (outputText.length > this.maxLengthStr.length) {
                this.maxLengthStr = outputText;
            }
        });

        let historicalHeight = 0;
        if (this.historicalServers.length > 0) {
            historicalHeight =
                40 + HISTORY_LINE_HEIGHT * this.historicalServers.length + 10;
            this.historicalServers.forEach((s) => {
                const sectionData = getServerInfoDisplaySectionText(s);
                const outputText =
                    sectionData.serverSection +
                    sectionData.playersSection +
                    sectionData.mapSection;
                if (outputText.length > this.maxLengthStr.length) {
                    this.maxLengthStr = outputText;
                }
            });
        }

        this.renderHeight =
            120 + this.serverList.length * 40 + historicalHeight;
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
        context.fillText(
            this.titleData.serversTotalSection +
                this.titleData.playersTotalStaticSection,
            10,
            10,
        );

        const titleStaticSectionWidth = context.measureText(
            this.titleData.serversTotalSection +
                this.titleData.playersTotalStaticSection,
        ).width;

        const allServersCapacity = this.serverList.reduce(
            (acc, cur) => acc + cur.max_players,
            0,
        );
        const allPlayersCount = this.serverList.reduce(
            (acc, cur) => acc + cur.current_players,
            0,
        );
        context.fillStyle = getCountColor(allPlayersCount, allServersCapacity);
        context.fillText(
            this.titleData.playersCountSection,
            10 + titleStaticSectionWidth,
            10,
        );

        this.renderStartY = 10 + 40 + 10;
    }

    renderList(context: Canvas2DContext) {
        context.font = 'bold 20pt Consolas';
        context.textAlign = 'left';
        context.textBaseline = 'top';
        context.fillStyle = '#3574d4';

        this.maxRectWidth = 0;
        this.serverList.forEach((s) => {
            context.font = 'bold 20pt Consolas';

            context.fillStyle = '#fff';
            const outputSectionText = getServerInfoDisplaySectionText(s);
            const allText =
                outputSectionText.serverSection +
                outputSectionText.playersSection +
                outputSectionText.mapSection;
            const allTextWidth = context.measureText(allText).width;
            if (allTextWidth > this.maxRectWidth) {
                this.maxRectWidth = allTextWidth;
            }

            context.fillText(
                outputSectionText.serverSection,
                20,
                10 + this.renderStartY,
            );
            const serverSectionWidth = context.measureText(
                outputSectionText.serverSection,
            ).width;

            context.fillStyle = getCountColor(s.current_players, s.max_players);
            context.fillText(
                outputSectionText.playersSection,
                20 + serverSectionWidth,
                10 + this.renderStartY,
            );
            const playersSectionWidth = context.measureText(
                outputSectionText.playersSection,
            ).width;

            context.fillStyle = '#fff';
            context.fillText(
                outputSectionText.mapSection,
                20 + serverSectionWidth + playersSectionWidth,
                10 + this.renderStartY,
            );

            this.renderStartY += 40;
        });
    }

    renderHistoricalList(context: Canvas2DContext) {
        if (this.historicalServers.length === 0) {
            return;
        }

        this.renderStartY += 15;

        context.font = 'bold 14pt Consolas';
        context.textAlign = 'left';
        context.textBaseline = 'top';
        context.fillStyle = '#9ca3af';
        context.fillText(HISTORY_SECTION_TITLE, 20, 10 + this.renderStartY);

        this.renderStartY += 40;

        context.font = '16pt Consolas';

        this.historicalServers.forEach((s) => {
            const sectionData = getServerInfoDisplaySectionText(s);

            context.fillStyle = '#6b7280';
            context.fillText(
                sectionData.serverSection,
                20,
                10 + this.renderStartY,
            );
            const serverSectionWidth = context.measureText(
                sectionData.serverSection,
            ).width;

            context.fillStyle = '#9ca3af';
            context.fillText(
                sectionData.playersSection,
                20 + serverSectionWidth,
                10 + this.renderStartY,
            );
            const playersSectionWidth = context.measureText(
                sectionData.playersSection,
            ).width;

            context.fillStyle = '#6b7280';
            context.fillText(
                sectionData.mapSection,
                20 + serverSectionWidth + playersSectionWidth,
                10 + this.renderStartY,
            );
            const mapSectionWidth = context.measureText(
                sectionData.mapSection,
            ).width;

            const elapsedMin = Math.ceil((Date.now() - s.lastSeenAt) / 60000);
            context.fillStyle = '#9ca3af';
            context.font = '12pt Consolas';
            context.fillText(
                `${elapsedMin}分钟前`,
                20 + serverSectionWidth + playersSectionWidth + mapSectionWidth,
                10 + this.renderStartY,
            );

            context.font = '16pt Consolas';
            this.renderStartY += HISTORY_LINE_HEIGHT;
        });
    }

    renderRect(context: Canvas2DContext) {
        context.strokeStyle = '#f48225';
        context.rect(
            10,
            this.renderStartY + 10,
            this.maxRectWidth + 20,
            this.contentLines * 40 + 10,
        );
        context.stroke();
        this.renderStartY += 10;
    }

    measureRender() {
        this.measureTitle();
        this.measureList();

        const canvas = createCanvas(this.measureMaxWidth, this.renderHeight);
        const context = canvas.getContext('2d');

        this.renderTitle(context);
        const titleWidth = context.measureText(this.totalTitle).width + 30;
        this.renderList(context);
        const listWidth = this.maxRectWidth + 40;
        this.renderHistoricalList(context);
        this.renderFooter(context);
        const footerWidth = context.measureText(this.totalFooter).width + 30;

        this.renderWidth = Math.max(titleWidth, listWidth, footerWidth);
    }

    render() {
        this.record();
        this.measureRender();

        const canvas = createCanvas(this.renderWidth, this.renderHeight);
        const context = canvas.getContext('2d');

        this.renderLayout(context, this.renderWidth, this.renderHeight);
        this.renderBgImg(context, this.renderWidth, this.renderHeight);
        this.renderTitle(context);
        this.renderRect(context);
        this.renderList(context);
        this.renderHistoricalList(context);
        this.renderFooter(context);

        return super.writeFile(canvas, this.fileName);
    }
}
