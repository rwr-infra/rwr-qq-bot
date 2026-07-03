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

