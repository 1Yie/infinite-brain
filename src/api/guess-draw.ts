import { client } from './client';

// =================================================================
// 类型定义 & 推导
// =================================================================

// 1. 推导 HTTP POST body 类型
type DrawEndpointBody = Parameters<
	ReturnType<(typeof client.api)['guess-draw']>['draw']['post']
>[0];
type StrokeData = DrawEndpointBody['stroke'];

// 游戏状态类型定义
export interface GameState {
	mode: 'free' | 'guess-draw';
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

export interface GuessDrawRoom {
	id: string;
	name: string;
	ownerId: string;
	ownerName: string;
	maxPlayers: number;
	currentPlayers: number;
	rounds: number;
	roundTime: number;
	isPrivate: boolean;
	status: 'waiting' | 'playing' | 'finished';
	createdAt: string;
}

export interface CreateRoomRequest {
	totalRounds?: number;
	roundTimeLimit?: number;
	roomName?: string;
	isPrivate?: boolean;
	password?: string;
}

// 猜测响应类型
export interface GuessResponse {
	success: boolean;
	message?: string;
	data?: {
		roomId: string;
		gameState: GameState;
		correct?: boolean;
		nextRound?: boolean;
		gameOver?: boolean;
	};
}

// 获取当前词语响应类型
export interface GetCurrentWordResponse {
	success: boolean;
	data?: {
		roomId: string;
		word: string | null;
		hint: string | null;
		isDrawer: boolean;
	};
}

// =================================================================
// HTTP API 导出
// =================================================================

export const guessDrawApi = {
	/**
	 * 获取词库
	 */
	getWords: async (): Promise<{
		success: boolean;
		data?: {
			words: string[];
			count: number;
		};
	}> => {
		const { data, error } = await client.api['guess-draw'].words.get();

		if (error) {
			throw new Error(error.value?.toString() || '获取词库失败');
		}

		return data;
	},

	/**
	 * 获取房间列表
	 */
	getRooms: async (): Promise<{
		success: boolean;
		data?: {
			rooms: GuessDrawRoom[];
			count: number;
		};
	}> => {
		const { data, error } = await client.api['guess-draw'].rooms.get();

		if (error) {
			throw new Error(error.value?.toString() || '获取房间列表失败');
		}

		return data;
	},

	/**
	 * 创建新游戏房间
	 * @param options 游戏配置选项
	 */
	createRoom: async (
		options: CreateRoomRequest = {}
	): Promise<{
		success: boolean;
		message?: string;
		data?: {
			roomId: string;
			gameState: GameState;
		};
	}> => {
		const { data, error } = await client.api['guess-draw'].rooms.post(options);

		if (error) {
			throw new Error(error.value?.toString() || '创建房间失败');
		}

		return data;
	},

	/**
	 * 加入游戏房间
	 * @param roomId 房间ID
	 * @param password 房间密码（可选）
	 */
	joinRoom: (roomId: string, password?: string) => {
		return client.api['guess-draw']({ roomId }).join.post({ password });
	},

	/**
	 * 获取房间游戏状态
	 * @param roomId 房间ID
	 */
	getRoomState: async (
		roomId: string
	): Promise<{
		success: boolean;
		message?: string;
		data?: {
			roomId: string;
			gameState: GameState;
		};
	}> => {
		const { data, error } = await client.api['guess-draw']({ roomId }).get();

		if (error) {
			throw new Error(error.value?.toString() || '获取房间状态失败');
		}

		return data;
	},

	/**
	 * 开始游戏
	 * @param roomId 房间ID
	 */
	startGame: async (
		roomId: string
	): Promise<{
		success: boolean;
		message?: string;
		data?: {
			roomId: string;
			gameState: GameState;
		};
	}> => {
		const { data, error } = await client.api['guess-draw']({
			roomId,
		}).start.post();

		if (error) {
			throw new Error(error.value?.toString() || '开始游戏失败');
		}

		return data;
	},

	/**
	 * 提交猜测
	 * @param roomId 房间ID
	 * @param guess 猜测的词语
	 */
	submitGuess: async (
		roomId: string,
		guess: string
	): Promise<GuessResponse> => {
		const { data, error } = await client.api['guess-draw']({
			roomId,
		}).guess.post({
			guess,
		});

		if (error) {
			throw new Error(error.value?.toString() || '提交猜测失败');
		}

		return data;
	},

	/**
	 * 获取当前词语（仅画者可见）
	 * @param roomId 房间ID
	 */
	getCurrentWord: async (roomId: string): Promise<GetCurrentWordResponse> => {
		const { data, error } = await client.api['guess-draw']({
			roomId,
		}).word.get();

		if (error) {
			throw new Error(error.value?.toString() || '获取当前词语失败');
		}

		return data;
	},

	/**
	 * 提交绘画数据
	 * @param roomId 房间ID
	 * @param stroke 绘画数据
	 */
	submitDrawing: async (
		roomId: string,
		stroke: StrokeData
	): Promise<{
		success: boolean;
		message?: string;
	}> => {
		const { data, error } = await client.api['guess-draw']({
			roomId,
		}).draw.post({
			stroke,
		});

		if (error) {
			throw new Error(error.value?.toString() || '提交绘画数据失败');
		}

		return data;
	},

	/**
	 * 结束游戏
	 * @param roomId 房间ID
	 */
	endGame: async (
		roomId: string
	): Promise<{
		success: boolean;
		message?: string;
		data?: {
			roomId: string;
			gameState: GameState;
			finalScores: GamePlayer[];
			winner: GamePlayer | null;
		};
	}> => {
		const { data, error } = await client.api['guess-draw']({
			roomId,
		}).end.post();

		if (error) {
			throw new Error(error.value?.toString() || '结束游戏失败');
		}

		if (!data.success) {
			throw new Error(data.message || '结束游戏失败');
		}

		return data;
	},
};

/**
 * 1. 定义核心连接函数
 * 用于类型推导 + 实际连接
 */
const createConnection = (roomId: string) => {
	return client.api.ws['guess-draw'].subscribe({
		query: { roomId },
	});
};

/**
 * 2. 提取 Socket 类型
 */
type GuessDrawSocket = ReturnType<typeof createConnection>;

/**
 * 3. 提取消息类型 (从 Socket 的 send 方法参数中提取)
 */
type ClientMessage = Parameters<GuessDrawSocket['send']>[0];

/**
 * 4. 提取 Draw 消息类型 (给外部组件使用)
 */
export type DrawMessage = Extract<ClientMessage, { type: 'draw' }>;

export const guessDrawWsApi = {
	/**
	 * 连接
	 */
	connect: createConnection,

	/**
	 * 通用发送
	 */
	send: (socket: GuessDrawSocket, msg: ClientMessage) => {
		socket.send(msg);
	},

	/**
	 * 发送绘图 (类型安全)
	 */
	sendDraw: (socket: GuessDrawSocket, data: DrawMessage['data']) => {
		socket.send({ type: 'draw', data } as ClientMessage);
	},

	/**
	 * 发送笔画结束
	 */
	sendStrokeFinish: (socket: GuessDrawSocket, data: DrawMessage['data']) => {
		socket.send({ type: 'stroke-finish', data } as ClientMessage);
	},

	/**
	 * 清空
	 */
	sendClear: (socket: GuessDrawSocket) => {
		socket.send({ type: 'clear' } as ClientMessage);
	},

	/**
	 * 猜词
	 */
	sendGuess: (socket: GuessDrawSocket, guess: string) => {
		socket.send({ type: 'guess-attempt', guess } as ClientMessage);
	},

	/**
	 * 开始游戏
	 */
	sendGameStart: (
		socket: GuessDrawSocket,
		totalRounds: number = 3,
		roundTimeLimit: number = 60
	) => {
		socket.send({
			type: 'game-start',
			totalRounds,
			roundTimeLimit,
		} as ClientMessage);
	},

	/**
	 * 聊天
	 */
	sendGameChat: (socket: GuessDrawSocket, message: string) => {
		socket.send({ type: 'game-chat', message } as ClientMessage);
	},
};
