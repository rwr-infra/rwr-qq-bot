import {
    createCanvas,
    loadImageFrom,
    toPngBuffer,
} from '../../../services/canvasBackend';

const INVISIBLE_SHAPE_REGEX =
    /<(path|rect)\b[^>]*fill-opacity="0"[^>]*stroke-width="0"[^>]*><\/\1>/g;

const TEXT_STROKE_ATTR_REGEX =
    /\s(?:stroke|stroke-width|paint-order|stroke-miterlimit)="[^"]*"/g;

export const sanitizeSvgForSkia = (svg: string): string => {
    return svg
        .replace(INVISIBLE_SHAPE_REGEX, '')
        .replace(/<text\b[^>]*>/g, (textTag) =>
            textTag.replace(TEXT_STROKE_ATTR_REGEX, ''),
        );
};

export const rasterizeSvgToPng = async (
    svg: string,
    width: number,
    height: number,
): Promise<Buffer> => {
    const sanitizedSvg = sanitizeSvgForSkia(svg);
    const image = await loadImageFrom(Buffer.from(sanitizedSvg));
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return toPngBuffer(canvas);
};
