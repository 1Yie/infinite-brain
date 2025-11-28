import { client } from '../client';
import type {
	DrawData,
	StrokeData,
} from '../../pages/board-room/white-board/whiteboard-canvas';

const createConnection = (roomId: string) => {
	return client.api.ws['guess-draw'].subscribe({
		query: { roomId },
	});
};

type GuessDrawSocket = ReturnType<typeof createConnection>;
type ClientMessage = Parameters<GuessDrawSocket['send']>[0];

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
	sendDraw: (socket: GuessDrawSocket, data: DrawData) => {
		socket.send({ type: 'draw', data } as ClientMessage);
	},

	/**
	 * 发送笔画结束
	 */
	sendStrokeFinish: (socket: GuessDrawSocket, data: StrokeData) => {
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
	sendGameStart: (socket: GuessDrawSocket, totalRounds: number = 3) => {
		socket.send({ type: 'game-start', totalRounds } as ClientMessage);
	},

	/**
	 * 聊天
	 */
	sendGameChat: (socket: GuessDrawSocket, message: string) => {
		socket.send({ type: 'game-chat', message } as ClientMessage);
	},
};
