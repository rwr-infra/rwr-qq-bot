import { createCanvas, Canvas2DContext } from '../../../services/canvasBackend';
import { IMapDataItem, OnlineServerItem } from '../types/types';
import {
    calcCanvasTextWidth,
    getCountColor,
    getServerInfoDisplaySectionText,
    getMapTextInCanvas,
    getMapShortName,
    formatMapDuration,
} from '../utils/utils';
import { BaseCanvas } from '../../../services/baseCanvas';

const UNDER_MAP_SERVER_SPACING = 20;

export class MapsCanvas extends BaseCanvas {
    // constructor params
    serverList: OnlineServerItem[];
    mapData: IMapDataItem[];
    fileName: string;
    mapStartedAtMap: Map<string, number | null> = new Map();

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
        mapData: IMapDataItem[],
        fileName: string,
        mapStartedAtMap: Map<string, number | null> = new Map(),
    ) {
        super();
        this.serverList = serverList;
        this.mapData = mapData;
        this.fileName = fileName;
        this.mapStartedAtMap = mapStartedAtMap;
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

        this.renderHeight = 120 + this.contentLines * 40;
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

                    const playersWidth = context.measureText(serverText.playersSection).width;
                    const serverKey = `${s.address}:${s.port}`;
                    const durationText = `  ${formatMapDuration(this.mapStartedAtMap.get(serverKey) ?? null)}`;
                    context.fillStyle = '#6b7280';
                    context.fillText(
                        durationText,
                        20 + UNDER_MAP_SERVER_SPACING + serverSectionWidth + playersWidth,
                        10 + this.renderStartY,
                    );

                    this.renderStartY += 40;

                    const allText =
                        serverText.serverSection + serverText.playersSection;
                    const durationWidth = context.measureText(durationText).width;
                    const allTextWidth =
                        context.measureText(allText).width +
                        UNDER_MAP_SERVER_SPACING +
                        durationWidth;

                    if (allTextWidth > this.maxRectWidth) {
                        this.maxRectWidth = allTextWidth;
                    }
                });
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
        // 加上两端间距
        const titleWidth = context.measureText(this.totalTitle).width + 30;
        this.renderList(context);
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
        this.renderFooter(context);

        return super.writeFile(canvas, this.fileName);
    }
}
