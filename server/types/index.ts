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

// 游戏词库
export const WORD_LIBRARY = [
	'苹果',
	'香蕉',
	'橙子',
	'葡萄',
	'西瓜',
	'菠萝',
	'草莓',
	'樱桃',
	'猫',
	'狗',
	'兔子',
	'狮子',
	'老虎',
	'大象',
	'猴子',
	'熊',
	'房子',
	'汽车',
	'飞机',
	'火车',
	'轮船',
	'自行车',
	'摩托车',
	'太阳',
	'月亮',
	'星星',
	'云朵',
	'雨伞',
	'彩虹',
	'雪人',
	'电脑',
	'手机',
	'电视',
	'冰箱',
	'洗衣机',
	'空调',
	'风扇',
	'书本',
	'铅笔',
	'橡皮',
	'尺子',
	'剪刀',
	'胶带',
	'胶水',
	'足球',
	'篮球',
	'乒乓球',
	'羽毛球',
	'网球',
	'排球',
	'棒球',
	'钢琴',
	'吉他',
	'小提琴',
	'鼓',
	'喇叭',
	'笛子',
	'口琴',
	'玫瑰',
	'牡丹',
	'菊花',
	'兰花',
	'荷花',
	'梅花',
	'樱花',
	'医生',
	'老师',
	'警察',
	'消防员',
	'厨师',
	'司机',
	'工人',
	'中国',
	'美国',
	'英国',
	'法国',
	'德国',
	'日本',
	'韩国',
	'长城',
	'故宫',
	'天安门',
	'埃菲尔铁塔',
	'自由女神像',
	'比萨斜塔',
];
