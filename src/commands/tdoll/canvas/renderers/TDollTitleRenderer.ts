import { Canvas2DContext } from '../../../../services/canvasBackend';
import { CANVAS_STYLE } from '../../types/constants';
import { ITDollDataItem } from '../../types/types';
import { replacedQueryMatch } from '../../utils/utils';

/**
 * TDoll 标题渲染器
 * 负责渲染 TDoll 标题，支持查询高亮
 */
export class TDollTitleRenderer {
    private renderStartY: number;
    private query: string;

    constructor(renderStartY: number, query: string) {
        this.renderStartY = renderStartY;
        this.query = query;
    }

    /**
     * 获取当前的 Y 坐标
     */
    getCurrentY(): number {
        return this.renderStartY;
    }

    /**
     * 渲染 TDoll 标题
     * @param context - Canvas 上下文
     * @param tdoll - TDoll 数据
     * @returns 渲染的总宽度
     */
    render(context: Canvas2DContext, tdoll: ITDollDataItem): number {
        const staticSection = 'No.';
        const noSection = `${tdoll.id}`;
        const staticSection2 = ` ${tdoll.nameIngame || ''}${tdoll.mod === '1' ? '(mod)' : ''} ${tdoll.type || ''}`;

        // 渲染 "No."
        context.fillStyle = CANVAS_STYLE.TEXT_COLOR;
        context.fillText(
            staticSection,
            CANVAS_STYLE.PADDING * 2,
            this.renderStartY,
        );
        const staticSectionWidth = context.measureText(staticSection).width;

        // 渲染 ID 数字
        context.fillStyle = '#f97316';
        context.fillText(
            noSection,
            CANVAS_STYLE.PADDING * 2 + staticSectionWidth,
            this.renderStartY,
        );
        const idSectionWidth = context.measureText(noSection).width;

        // 渲染名称（带高亮）
        const startX =
            CANVAS_STYLE.PADDING * 2 + staticSectionWidth + idSectionWidth;
        const nameWidth = this.renderNameWithHighlight(
            context,
            staticSection2,
            startX,
        );

        this.renderStartY += CANVAS_STYLE.LINE_HEIGHT;

        return staticSectionWidth + idSectionWidth + nameWidth;
    }

    /**
     * 渲染名称，支持查询高亮
     */
    private renderNameWithHighlight(
        context: Canvas2DContext,
        name: string,
        startX: number,
    ): number {
        if (!this.query || this.query === 'random') {
            context.fillStyle = CANVAS_STYLE.TEXT_COLOR;
            context.fillText(name, startX, this.renderStartY);
            return context.measureText(name).width;
        }

        const processedName = replacedQueryMatch(name);
        const processedQuery = replacedQueryMatch(this.query);
        const queryIndex = processedName.indexOf(processedQuery);

        if (queryIndex === -1) {
            context.fillStyle = CANVAS_STYLE.TEXT_COLOR;
            context.fillText(name, startX, this.renderStartY);
            return context.measureText(name).width;
        }

        // 计算高亮位置
        const { before, match, after } = this.calculateHighlightSegments(
            name,
            queryIndex,
            processedQuery.length,
        );

        // 渲染高亮文本
        return this.renderHighlightedText(
            context,
            before,
            match,
            after,
            startX,
        );
    }

    /**
     * 计算高亮段落
     */
    private calculateHighlightSegments(
        name: string,
        queryIndex: number,
        queryLength: number,
    ): { before: string; match: string; after: string } {
        let matchStartIndex = 0;
        let matchEndIndex = 0;
        let currentProcessedIndex = 0;

        for (let i = 0; i < name.length; i++) {
            if (currentProcessedIndex === queryIndex) {
                matchStartIndex = i;
            }
            if (currentProcessedIndex === queryIndex + queryLength) {
                matchEndIndex = i;
                break;
            }
            if (!/[-. ]/.test(name[i])) {
                currentProcessedIndex++;
            }
        }

        if (matchEndIndex === 0) {
            matchEndIndex = name.length;
        }

        return {
            before: name.substring(0, matchStartIndex),
            match: name.substring(matchStartIndex, matchEndIndex),
            after: name.substring(matchEndIndex),
        };
    }

    /**
     * 渲染带高亮的文本
     */
    private renderHighlightedText(
        context: Canvas2DContext,
        before: string,
        match: string,
        after: string,
        startX: number,
    ): number {
        // 渲染前段
        context.fillStyle = CANVAS_STYLE.TEXT_COLOR;
        context.fillText(before, startX, this.renderStartY);
        const beforeWidth = context.measureText(before).width;

        // 渲染匹配段（高亮）
        context.fillStyle = CANVAS_STYLE.HIGHLIGHT_COLOR;
        context.fillText(match, startX + beforeWidth, this.renderStartY);
        const matchWidth = context.measureText(match).width;

        // 渲染后段
        context.fillStyle = CANVAS_STYLE.TEXT_COLOR;
        context.fillText(
            after,
            startX + beforeWidth + matchWidth,
            this.renderStartY,
        );

        return beforeWidth + matchWidth + context.measureText(after).width;
    }
}
