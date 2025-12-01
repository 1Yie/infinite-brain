import { client } from '../client';
/**
 * 定义核心连接函数
 * 用于类型推导 + 实际连接
 */
const createColorClashConnection = (roomId: string) => {
	return client.api.ws['color-clash'].subscribe({
		query: { roomId },
	});
};

/**
 * 提取 Socket 类型
 */
type ColorClashSocket = ReturnType<typeof createColorClashConnection>;

/**
 * 提取消息类型 (从 Socket 的 send 方法参数中提取)
 */
type ColorClashClientMessageType = Parameters<ColorClashSocket['send']>[0];

/**
 * 提取消息类型 (给外部使用)
 */
export type ColorClashClientMessage = ColorClashClientMessageType;
export type ColorClashDrawMessage = Extract<
	ColorClashClientMessage,
	{ type: 'draw' }
>;

export const colorClashWsApi = {
	/**
	 * 连接
	 */
	connect: createColorClashConnection,

	/**
	 * 通用发送
	 */
	send: (socket: ColorClashSocket, msg: ColorClashClientMessage) => {
		socket.send(msg);
	},

	/**
	 * 发送绘图 (类型安全)
	 */
	sendDraw: (socket: ColorClashSocket, data: ColorClashDrawMessage['data']) => {
		socket.send({ type: 'draw', data } as ColorClashClientMessageType);
	},

	/**
	 * 开始游戏
	 */
	sendGameStart: (socket: ColorClashSocket) => {
		socket.send({ type: 'game-start' } as ColorClashClientMessageType);
	},

	/**
	 * 发送聊天消息
	 */
	sendGameChat: (
		socket: ColorClashSocket,
		data: { message: string; username: string; id?: string }
	) => {
		try {
			const msg = {
				type: 'game-chat',
				message: data.message,
				username: data.username,
			} as ColorClashClientMessageType;
			console.log('sending chat message:', msg);
			socket.send(msg);
		} catch (error) {
			console.error('发送聊天消息失败:', error);
			throw new Error('连接已断开，请重新连接');
		}
	},

	/**
	 * 发送心跳包
	 */
	sendPing: (socket: ColorClashSocket) => {
		socket.send({ type: 'ping' } as ColorClashClientMessageType);
	},
};
