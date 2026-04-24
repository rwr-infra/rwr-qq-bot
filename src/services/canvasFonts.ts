import fs from 'node:fs';
import path from 'node:path';
import { FontLibrary } from 'skia-canvas';

let initialized = false;

export const CANVAS_FONT_FAMILY =
    'Consolas, Noto Sans CJK SC, Noto Sans SC, WenQuanYi Zen Hei, Noto Color Emoji, sans-serif';

export const CHART_FONT_FAMILY =
    'Noto Sans CJK SC, Noto Color Emoji, sans-serif';

export function buildCanvasFont(
    sizePt: number,
    weight: 'normal' | 'bold' = 'bold',
): string {
    return `${weight} ${sizePt}pt ${CANVAS_FONT_FAMILY}`;
}

export function initCanvasFonts() {
    if (initialized) {
        return;
    }
    initialized = true;

    // Best-effort: register the bundled font if present.
    // This keeps local + CI rendering more consistent without requiring any user config.
    const bundledConsola = path.join(process.cwd(), 'consola.ttf');
    if (fs.existsSync(bundledConsola)) {
        try {
            // Signature: addFamily(familyName, weight|options, [files])
            const native = (FontLibrary as any).native as
                | { addFamily: (...args: any[]) => unknown }
                | undefined;
            native?.addFamily('Consolas', 400, [bundledConsola]);
            native?.addFamily('Consolas', 700, [bundledConsola]);
        } catch {
            // Ignore font registration failures; rendering will fall back to system fonts.
        }
    }
}
