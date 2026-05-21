import { createCanvas, Canvas2DContext } from '../../../services/canvasBackend';
import {
    HistoricalServerItem,
    IMapDataItem,
    OnlineServerItem,
} from '../types/types';
import {
    calcCanvasTextWidth,
    getCountColor,
    getServerInfoDisplaySectionText,
    getMapTextInCanvas,
    getMapShortName,
} from '../utils/utils';
import { BaseCanvas } from '../../../services/baseCanvas';

const UNDER_MAP_SERVER_SPACING = 20;
const HISTORY_LINE_HEIGHT = 30;
const HISTORY_SECTION_TITLE = '近5分钟离线服务器';

export class MapsCanvas extends BaseCanvas {
    // constructor params
    serverList: OnlineServerItem[];
    historicalServers: HistoricalServerItem[];
    mapData: IMapDataItem[];
    fileName: string;

    // render params data
    measureMaxWidth = 0;
    renderWidth = 0;
    renderHeight = 0;

    totalTitle = '';

    maxLengthStr = '';
    renderStartY = 0;
    maxRectWidth = 0;
    contentLines = 0;

    totalFooter = '';

    constructor(
        serverList: OnlineServerItem[],
        historicalServers: HistoricalServerItem[],
        mapData: IMapDataItem[],
        fileName: string,
    ) {
        super();
        this.serverList = serverList;
        this.historicalServers = historicalServers;
        this.mapData = mapData;
        this.fileName = fileName;
    }

    measureTitle() {
        const title = `共计 ${this.mapData.length} 项地图数据`;

        const titleWidth = calcCanvasTextWidth(title, 20) + 20;
        this.totalTitle = title;

        if (titleWidth > this.measureMaxWidth) {
            this.measureMaxWidth = titleWidth;
        }
    }

    measureList() {
        this.maxLengthStr = '';

        /**
         * map_id => count
         */
        const serverMapRecord = new Map<string, number>();

        this.serverList.forEach((s) => {
            const sectionData = getServerInfoDisplaySectionText(s);
            const outputText =
                sectionData.serverSection +
                sectionData.playersSection +
                new Array(8).fill('');
            if (outputText.length > this.maxLengthStr.length) {
                this.maxLengthStr = outputText;
            }

            const mapShortName = getMapShortName(s.map_id);

            const record = serverMapRecord.get(mapShortName) ?? 0;

            serverMapRecord.set(mapShortName, record + 1);
        });

        this.mapData.forEach((m) => {
            this.contentLines += 1;

            const serversCountUnderMap = serverMapRecord.get(m.id);
            if (serversCountUnderMap) {
                this.contentLines += serversCountUnderMap;
            }

            const sectionData = getMapTextInCanvas(m);

            const outputText = sectionData;

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
            120 + this.contentLines * 40 + historicalHeight;
    }

    renderLayout(context: Canvas2DContext, width: number, height: number) {
        context.fillStyle = '#451a03';
        context.fillRect(0, 0, width, height);
    }

    renderTitle(context: Canvas2DContext) {
        context.font = 'bold 20pt Consolas';
        context.textAlign = 'left';
        context.textBaseline = 'top';
        context.fillStyle = '#3574d4';

        context.fillStyle = '#fff';
        context.fillText(this.totalTitle, 10, 10);

        this.renderStartY = 10 + 40 + 10;
    }

    renderList(context: Canvas2DContext) {
        context.font = 'bold 20pt Consolas';
        context.textAlign = 'left';
        context.textBaseline = 'top';
        context.fillStyle = '#3574d4';

        this.maxRectWidth = 0;

        this.mapData.forEach((m) => {
            context.fillStyle = '#bfdbfe';
            const mapText = getMapTextInCanvas(m);
            // map section
            context.fillText(mapText, 20, 10 + this.renderStartY);
            this.renderStartY += 40;

            const mapSectionWidth = context.measureText(mapText).width;
            if (mapSectionWidth > this.maxRectWidth) {
                this.maxRectWidth = mapSectionWidth;
            }

            this.serverList
                .filter((s) => {
                    return getMapShortName(s.map_id) === m.id;
                })
                .forEach((s) => {
                    // server section
                    const serverText = getServerInfoDisplaySectionText(s);
                    context.fillStyle = '#fff';
                    context.fillText(
                        serverText.serverSection,
                        20 + UNDER_MAP_SERVER_SPACING,
                        10 + this.renderStartY,
                    );
                    const serverSectionWidth = context.measureText(
                        serverText.serverSection,
                    ).width;

                    // count section
                    context.fillStyle = getCountColor(
                        s.current_players,
                        s.max_players,
                    );
                    context.fillText(
                        serverText.playersSection,
                        20 + UNDER_MAP_SERVER_SPACING + serverSectionWidth,
                        10 + this.renderStartY,
                    );

                    // count section
                    context.fillStyle = getCountColor(
                        s.current_players,
                        s.max_players,
                    );
                    context.fillText(
                        serverText.playersSection,
                        20 + UNDER_MAP_SERVER_SPACING + serverSectionWidth,
                        10 + this.renderStartY,
                    );

                    this.renderStartY += 40;

                    const allText =
                        serverText.serverSection + serverText.playersSection;
                    const allTextWidth =
                        context.measureText(allText).width +
                        UNDER_MAP_SERVER_SPACING;

                    if (allTextWidth > this.maxRectWidth) {
                        this.maxRectWidth = allTextWidth;
                    }
                });
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
            const yOffset = 8 / 3;
            const spaceWidth = context.measureText(' ').width;
            context.fillText(
                `${elapsedMin}分钟前`,
                20 + serverSectionWidth + playersSectionWidth + mapSectionWidth + spaceWidth,
                10 + this.renderStartY + yOffset,
            );

            const allText =
                sectionData.serverSection +
                sectionData.playersSection +
                sectionData.mapSection;
            context.font = '16pt Consolas';
            const allTextWidth = context.measureText(allText).width + spaceWidth + context.measureText(`${elapsedMin}分钟前`).width;
            if (allTextWidth > this.maxRectWidth) {
                this.maxRectWidth = allTextWidth;
            }

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
        this.renderHistoricalList(context);
        const listWidth = this.maxRectWidth + 40;
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
