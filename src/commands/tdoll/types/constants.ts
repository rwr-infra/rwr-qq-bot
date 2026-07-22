import { TDollCategoryEnum } from './enums';

export const TDOLL_RANDOM_KEY = 'random';

export const TDOLL_URL_PREFIX = 'https://www.gfwiki.org';

export const TDOLL_CATEGORY_EN_MAPPER: Record<string, TDollCategoryEnum> = {
    ar: TDollCategoryEnum.AR,
    smg: TDollCategoryEnum.SMG,
    rf: TDollCategoryEnum.RF,
    mg: TDollCategoryEnum.MG,
    sg: TDollCategoryEnum.SG,
    hg: TDollCategoryEnum.HG,
};

export const TDOLL_CATEGORY_CN_MAPPER: Record<string, TDollCategoryEnum> = {
    突击步枪: TDollCategoryEnum.AR,
    冲锋枪: TDollCategoryEnum.SMG,
    步枪: TDollCategoryEnum.RF,
    机枪: TDollCategoryEnum.MG,
    霰弹枪: TDollCategoryEnum.SG,
    手枪: TDollCategoryEnum.HG,
};

export const TDOLL_SKIN_NOT_FOUND_MSG =
    '未找到指定人形编号的皮肤, 请检查输入是否有误, 请注意需要输入编号而非名称!\n若确认输入编号无误, 多数是 gfwiki 数据问题, 请尝试去 gfwiki 查看数据(这并不是 bot 本身问题)';

/**
 * 双参数(武器编号 + 皮肤ID)查询皮肤原图时的下载超时与提示文案。
 *
 * bot 端先发"加载中"提示, 再用 fetch 把远端 gfwiki 原图下载到 out/ 并以本地
 * 图片回发(与单参数网格图一致), 下载超过该阈值则改为发送超时提示。
 */
export const SKIN_RAW_IMAGE_TIMEOUT_MS = 15_000;
export const SKIN_RAW_IMAGE_LOADING_MSG = '正在加载皮肤原图, 请稍候...';
export const SKIN_RAW_IMAGE_TIMEOUT_MSG =
    '皮肤原图加载超时或失败, 请稍后重试';

