import { createCanvas, Canvas2DContext } from '../../../services/canvasBackend';
import { OnlineServerItem } from '../types/types';
import {
    getServersHeaderDisplaySectionText,
    calcCanvasTextWidth,
    getServerInfoDisplaySectionText,
    getCountColor,
    getPlayersInServer,
} from '../utils/utils';
import { BaseCanvas } from '../../../services/baseCanvas';

const MODERATOR_BADGE_DEFAULT = '⭐';

export class PlayersCanvas extends BaseCanvas {
    // constructor params
    serverList: OnlineServerItem[];
    fileName: string;
    moderators: string[];
    moderatorBadge: string;

    // render params data
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
        fileName: string,
        moderators?: string[],
        moderatorBadge?: string,
    ) {
        super();
        this.serverList = serverList;
        this.fileName = fileName;
        this.moderators = moderators ?? [];
        this.moderatorBadge = moderatorBadge ?? MODERATOR_BADGE_DEFAULT;
    }

    private isModerator(playerName: string): boolean {
        return this.moderators.some(
            (m) => m.toUpperCase() === playerName.toUpperCase(),
        );
    }

    private getPlayerDisplayName(playerName: string): string {
        return this.isModerator(playerName)
            ? `${playerName} ${this.moderatorBadge}`
            : playerName;
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
            const sectionData = getServerInfoDisplaySectionText(s);
            const outputText =
                sectionData.serverSection + sectionData.playersSection;
            if (outputText.length > this.maxLengthStr.length) {
                this.maxLengthStr = outputText;
            }
            this.contentLines += 1;

            // Players max width
            getPlayersInServer(s).forEach((p) => {
                this.contentLines += 1;
                const displayName = this.getPlayerDisplayName(p);
                if (displayName.length > this.maxLengthStr.length) {
                    this.maxLengthStr = displayName;
                }
            });
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
        // count
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
            /**
             * Render server info text
             */
            context.fillStyle = '#fff';
            const outputSectionText = getServerInfoDisplaySectionText(s);
            // all text, update maxRectWidth
            const allText =
                outputSectionText.serverSection +
                outputSectionText.playersSection +
                outputSectionText.mapSection;
            const allTextWidth = context.measureText(allText).width;
            if (allTextWidth > this.maxRectWidth) {
                this.maxRectWidth = allTextWidth;
            }

            // server section
            context.fillText(
                outputSectionText.serverSection,
                20,
                10 + this.renderStartY,
            );
            const serverSectionWidth = context.measureText(
                outputSectionText.serverSection,
            ).width;

            // count section
            context.fillStyle = getCountColor(s.current_players, s.max_players);
            context.fillText(
                outputSectionText.playersSection,
                20 + serverSectionWidth,
                10 + this.renderStartY,
            );
            const playersSectionWidth = context.measureText(
                outputSectionText.playersSection,
            ).width;

            // map section
            context.fillStyle = '#fff';
            context.fillText(
                outputSectionText.mapSection,
                20 + serverSectionWidth + playersSectionWidth,
                10 + this.renderStartY,
            );

            // render players
            context.font = 'bold 16pt Consolas';
            context.fillStyle = '#a5f3fc';
            getPlayersInServer(s).forEach((p) => {
                const displayName = this.getPlayerDisplayName(p);
                const textWidth = context.measureText(displayName).width;
                if (textWidth > this.maxRectWidth) {
                    this.maxRectWidth = textWidth;
                }
                context.fillText(displayName, 20, 10 + this.renderStartY + 40);
                this.renderStartY += 40;
            });

            this.renderStartY += 40;
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
