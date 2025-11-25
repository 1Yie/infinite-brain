import { client } from './client';

type BoardSocket = ReturnType<typeof client.api.ws.board.subscribe>;
type SendArgs = Parameters<BoardSocket['send']>[0];
type SingleMessage = Exclude<SendArgs, Array<SendArgs>>;

export const wsApi = {
	/**
	 * 建立 WebSocket 连接
	 * @param roomId 房间ID
	 * @returns EdenWS 实例
	 */
	connect: (roomId: string): BoardSocket => {
		return client.api.ws.board.subscribe({
			query: { roomId },
		});
	},

	/**
	 * 辅助函数：格式化发送绘图数据
	 */
	sendDraw: (connection: BoardSocket, data: SingleMessage['data']) => {
		connection.send({
			type: 'draw',
			data: data,
		});
	},

	/**
	 * 辅助函数：发送清空画布指令
	 */
	sendClear: (connection: BoardSocket) => {
		connection.send({
			type: 'clear',
		});
	},

	/**
	 * 辅助函数：发送撤销操作
	 */
	sendUndo: (connection: BoardSocket) => {
		connection.send({
			type: 'undo',
		});
	},

	/**
	 * 辅助函数：发送光标位置
	 */
	sendCursor: (connection: BoardSocket, data: SingleMessage['data']) => {
		connection.send({
			type: 'cursor',
			data: data,
		});
	},
};
