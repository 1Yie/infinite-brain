import { t } from 'elysia';

export const DrawDataSchema = t.Object({
	x: t.Number(),
	y: t.Number(),
	prevX: t.Optional(t.Number()),
	prevY: t.Optional(t.Number()),
	color: t.Optional(t.String()),
	size: t.Optional(t.Number()),
	tool: t.Optional(t.String()),
});

export const StrokePointSchema = t.Object({
	x: t.Number(),
	y: t.Number(),
});

export const StrokeFinishSchema = t.Object({
	id: t.String(),
	tool: t.String(),
	color: t.String(),
	size: t.Number(),
	points: t.Array(StrokePointSchema),
	createdAt: t.Optional(t.String()),
});

export const CursorDataSchema = t.Object({
	x: t.Number(),
	y: t.Number(),
});

export const BoardMessageSchema = t.Object({
	type: t.Union([
		t.Literal('draw'),
		t.Literal('stroke-finish'),
		t.Literal('clear'),
		t.Literal('undo'),
		t.Literal('redo'),
		t.Literal('cursor'),
	]),
	data: t.Optional(
		t.Union([DrawDataSchema, StrokeFinishSchema, CursorDataSchema, t.Any()])
	),
	strokeId: t.Optional(t.String()), // 用于指定撤销的笔画ID
});

export const GameMessageSchema = t.Object({
	type: t.Union([
		t.Literal('game-start'),
		t.Literal('guess-attempt'),
		t.Literal('game-chat'),
		t.Literal('draw'),
		t.Literal('stroke-finish'),
		t.Literal('clear'),
	]),
	data: t.Optional(t.Any()),
	totalRounds: t.Optional(t.Number()), // 游戏总轮数
	roundTimeLimit: t.Optional(t.Number()), // 回合时间限制
	guess: t.Optional(t.String()), // 猜词内容
	message: t.Optional(t.String()), // 聊天消息
});

export const MessageSchema = t.Union([BoardMessageSchema, GameMessageSchema]);

// 游戏相关类型
export type GameMode = 'free' | 'guess-draw';

export interface GameState {
	mode: GameMode;
	isActive: boolean;
	currentRound: number;
	totalRounds: number;
	currentDrawer: string | null;
	currentWord: string | null;
	wordHint: string | null;
	roundStartTime: number | null;
	roundTimeLimit: number;
	players: GamePlayer[];
	usedWords: string[];
}

export interface GamePlayer {
	userId: string;
	username: string;
	score: number;
	hasGuessed: boolean;
	isDrawing: boolean;
}

export interface GuessAttempt {
	userId: string;
	username: string;
	guess: string;
	isCorrect: boolean;
	timestamp: number;
}

// 游戏词库 - 增强版本含类别
export interface WordEntry {
	word: string;
	category: string;
}

export const WORD_LIBRARY: WordEntry[] = [
	// 水果
	{ word: '苹果', category: '水果' },
	{ word: '香蕉', category: '水果' },
	{ word: '橙子', category: '水果' },
	{ word: '葡萄', category: '水果' },
	{ word: '西瓜', category: '水果' },
	{ word: '菠萝', category: '水果' },
	{ word: '草莓', category: '水果' },
	{ word: '樱桃', category: '水果' },
	// 动物
	{ word: '猫', category: '动物' },
	{ word: '狗', category: '动物' },
	{ word: '兔子', category: '动物' },
	{ word: '狮子', category: '动物' },
	{ word: '老虎', category: '动物' },
	{ word: '大象', category: '动物' },
	{ word: '猴子', category: '动物' },
	{ word: '熊', category: '动物' },
	// 交通工具
	{ word: '房子', category: '建筑物' },
	{ word: '汽车', category: '交通工具' },
	{ word: '飞机', category: '交通工具' },
	{ word: '火车', category: '交通工具' },
	{ word: '轮船', category: '交通工具' },
	{ word: '自行车', category: '交通工具' },
	{ word: '摩托车', category: '交通工具' },
	// 天体
	{ word: '太阳', category: '天体' },
	{ word: '月亮', category: '天体' },
	{ word: '星星', category: '天体' },
	{ word: '云朵', category: '天气' },
	{ word: '雨伞', category: '用品' },
	{ word: '彩虹', category: '天气' },
	{ word: '雪人', category: '冬季' },
	// 电器
	{ word: '电脑', category: '电器' },
	{ word: '手机', category: '电器' },
	{ word: '电视', category: '电器' },
	{ word: '冰箱', category: '电器' },
	{ word: '洗衣机', category: '电器' },
	{ word: '空调', category: '电器' },
	{ word: '风扇', category: '电器' },
	// 文具
	{ word: '书本', category: '文具' },
	{ word: '铅笔', category: '文具' },
	{ word: '橡皮', category: '文具' },
	{ word: '尺子', category: '文具' },
	{ word: '剪刀', category: '文具' },
	{ word: '胶带', category: '文具' },
	{ word: '胶水', category: '文具' },
	// 体育运动
	{ word: '足球', category: '运动' },
	{ word: '篮球', category: '运动' },
	{ word: '乒乓球', category: '运动' },
	{ word: '羽毛球', category: '运动' },
	{ word: '网球', category: '运动' },
	{ word: '排球', category: '运动' },
	{ word: '棒球', category: '运动' },
	// 音乐乐器
	{ word: '钢琴', category: '乐器' },
	{ word: '吉他', category: '乐器' },
	{ word: '小提琴', category: '乐器' },
	{ word: '鼓', category: '乐器' },
	{ word: '喇叭', category: '乐器' },
	{ word: '笛子', category: '乐器' },
	{ word: '口琴', category: '乐器' },
	// 花朵
	{ word: '玫瑰', category: '花' },
	{ word: '牡丹', category: '花' },
	{ word: '菊花', category: '花' },
	{ word: '兰花', category: '花' },
	{ word: '荷花', category: '花' },
	{ word: '梅花', category: '花' },
	{ word: '樱花', category: '花' },
	// 职业
	{ word: '医生', category: '职业' },
	{ word: '老师', category: '职业' },
	{ word: '警察', category: '职业' },
	{ word: '消防员', category: '职业' },
	{ word: '厨师', category: '职业' },
	{ word: '司机', category: '职业' },
	{ word: '工人', category: '职业' },
	// 国家
	{ word: '中国', category: '国家' },
	{ word: '美国', category: '国家' },
	{ word: '英国', category: '国家' },
	{ word: '法国', category: '国家' },
	{ word: '德国', category: '国家' },
	{ word: '日本', category: '国家' },
	{ word: '韩国', category: '国家' },
	// 地标建筑
	{ word: '长城', category: '建筑物' },
	{ word: '故宫', category: '建筑物' },
	{ word: '天安门', category: '建筑物' },
	{ word: '埃菲尔铁塔', category: '建筑物' },
	{ word: '自由女神像', category: '建筑物' },
	{ word: '比萨斜塔', category: '建筑物' },
];
