import { getOrCreateI18n } from '@affine/i18n';
import type { ExtensionType } from '@blocksuite/affine/store';
import {
  SlashMenuDisplayOptionsIdentifier,
  type SlashMenuItem,
} from '@blocksuite/affine/widgets/slash-menu';

// Command identities stay in English; labels and search vocabulary are presentation only.
export const chineseSlashVocabulary: Record<
  string,
  [string, string, string, string?]
> = {
  Text: ['正文', 'zhengwen', 'zw', '文本 段落'],
  'Heading 1': ['一级标题', 'yijibiaoti', 'yjbt', '标题 biaoti bt h1'],
  'Heading 2': ['二级标题', 'erjibiaoti', 'ejbt', '标题 biaoti bt h2'],
  'Heading 3': ['三级标题', 'sanjibiaoti', 'sjbt', '标题 biaoti bt h3'],
  'Heading 4': ['四级标题', 'sijibiaoti', 'sjbt', '标题 biaoti bt h4'],
  'Heading 5': ['五级标题', 'wujibiaoti', 'wjbt', '标题 biaoti bt h5'],
  'Heading 6': ['六级标题', 'liujibiaoti', 'ljbt', '标题 biaoti bt h6'],
  'Other Headings': ['更多标题', 'gengduobiaoti', 'gdbt'],
  'Bulleted List': ['无序列表', 'wuxuliebiao', 'wxlb', '列表 liebiao lb'],
  'Numbered List': ['有序列表', 'youxuliebiao', 'yxlb', '编号 bianhao bh'],
  'To-do List': [
    '待办列表',
    'daibanliebiao',
    'dblb',
    '待办 daiban db 任务 renwu rw',
  ],
  'Code Block': ['代码块', 'daimakuai', 'dmk', '代码 daima dm'],
  Quote: ['引用', 'yinyong', 'yy'],
  Divider: ['分割线', 'fengexian', 'fgx'],
  Image: ['图片', 'tupian', 'tp', '图像 照片'],
  Attachment: ['附件', 'fujian', 'fj', '文件 wenjian wj'],
  PDF: ['PDF 文件', 'pdf', 'pdf'],
  Table: ['简单表格', 'jiandanbiaoge', 'jdbg', '表格 biaoge bg'],
  'Table View': ['数据表', 'shujubiao', 'sjb', '数据库 shujuku sjk'],
  'Kanban View': ['看板', 'kanban', 'kb'],
  'Calendar View': ['日历', 'rili', 'rl'],
  'New Doc': ['新建页面', 'xinjianyemian', 'xjym', '页面 yemian ym'],
  'Linked Doc': ['链接页面', 'lianjieyemian', 'ljym', '页面 yemian ym'],
  Link: ['链接', 'lianjie', 'lj', '网址 wangzhi wz'],
  Callout: ['提示块', 'tishikuai', 'tsk', '强调 qiangdiao qd'],
  Equation: ['公式', 'gongshi', 'gs'],
  'Inline equation': ['行内公式', 'hangneigongshi', 'hngs'],
  'Align left': ['左对齐', 'zuoduiqi', 'zdq'],
  'Align center': ['居中', 'juzhong', 'jz'],
  'Align right': ['右对齐', 'youduiqi', 'ydq'],
  Bold: ['加粗', 'jiacu', 'jc'],
  Italic: ['斜体', 'xieti', 'xt'],
  Underline: ['下划线', 'xiahuaxian', 'xhx'],
  Strikethrough: ['删除线', 'shanchuxian', 'scx'],
  Today: ['今天', 'jintian', 'jt'],
  Tomorrow: ['明天', 'mingtian', 'mt'],
  Yesterday: ['昨天', 'zuotian', 'zt'],
  Now: ['当前时间', 'dangqianshijian', 'dqsj'],
  'Move Up': ['上移', 'shangyi', 'sy'],
  'Move Down': ['下移', 'xiayi', 'xy'],
  Copy: ['复制到剪贴板', 'fuzhidaojiantieban', 'fzdjtb', '复制 fuzhi fz'],
  Duplicate: ['创建副本', 'chuangjianfuben', 'cjfb', '副本 fuben fb 复制块'],
  Delete: ['删除', 'shanchu', 'sc'],
  Frame: ['画布框架', 'huabukuangjia', 'hbkj'],
  'Mind Map': ['思维导图', 'siweidaotu', 'swdt'],
  'Ask AI': ['询问 AI', 'xunwenai', 'xwai', '人工智能 rengongzhineng rgzn'],
  'Fix spelling from above': ['修正上文拼写', 'xiuzhengpinxie', 'xzpx'],
  'Fix grammar from above': ['修正上文语法', 'xiuzhengyufa', 'xzyf'],
  'Continue writing': ['继续写作', 'jixuxiezuo', 'jxxz'],
  Summarize: ['总结', 'zongjie', 'zj'],
  Translate: ['翻译', 'fanyi', 'fy'],
};

export function localizeSlashItem(
  item: SlashMenuItem,
  language: string
): SlashMenuItem {
  const words = chineseSlashVocabulary[item.id ?? item.name];
  if (!words) return item;
  const chinese = language.startsWith('zh');
  return {
    ...item,
    label: chinese ? words[0] : item.label,
    description: chinese ? undefined : item.description,
    searchAlias: [
      ...(item.searchAlias ?? []),
      ...words.slice(0, 3),
      ...(words[3]?.split(' ') ?? []),
    ] as string[],
    ...('tooltip' in item && item.tooltip && chinese
      ? { tooltip: { ...item.tooltip, caption: words[0] } }
      : {}),
  };
}

const groups: Record<string, string> = {
  Basic: '基础',
  List: '列表',
  Align: '对齐',
  Style: '格式',
  Page: '页面',
  Media: '媒体',
  Advanced: '高级',
  Database: '数据库',
  Date: '日期',
  Actions: '操作',
};

export const slashMenuLocaleExtension: ExtensionType = {
  setup: di =>
    di.addImpl(SlashMenuDisplayOptionsIdentifier, {
      transform: item => localizeSlashItem(item, getOrCreateI18n().language),
      groupLabel: name =>
        getOrCreateI18n().language.startsWith('zh')
          ? (groups[name] ?? name)
          : name,
      noResults: () =>
        getOrCreateI18n().language.startsWith('zh')
          ? '没有匹配的命令'
          : 'No matching commands',
    }),
};
