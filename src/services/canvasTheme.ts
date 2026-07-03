/**
 * 画布共享主题配色 — 全部图片输出统一的设计语言。
 * 与 ServersCanvas/PlayersCanvas 家族一致: #451a03 暖棕底 + OUTPUT_BG_IMG 可叠加。
 */
export const CANVAS_COLORS = {
    /** 暖棕底色 */
    BG: '#451a03',
    /** 半透明深色面板, 叠在底色或背景图上均协调 */
    CARD: 'rgba(0, 0, 0, 0.5)',
    /** 橙色强调(边框/分节条/角标) */
    ACCENT: '#f48225',
    /** 主文本 */
    TEXT: '#f8fafc',
    /** 暖色调中性灰(辅助文本) */
    MUTED: '#cbb8a3',
    /** 数值高亮(琥珀金) */
    VALUE: '#fcd34d',
} as const;
