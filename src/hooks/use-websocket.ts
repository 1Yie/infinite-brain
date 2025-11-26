import { useEffect, useRef, useState, useCallback } from 'react';
import { wsApi } from '../api/ws';
import type { StrokeData } from '../types/whiteboard';

type BoardSocket = ReturnType<typeof wsApi.connect>;
type DrawData = Parameters<typeof wsApi.sendDraw>[1];

// export interface StrokeData {
// 	id: string;
// 	tool: string;
// 	color: string;
// 	size: number;
// 	points: { x: number; y: number }[];
// }

type ServerMessage =
	| { type: 'connected'; userId: string; username: string; timestamp: number }
	| {
			type: 'user-joined';
			userId: string;
			username: string;
			userCount: number;
			timestamp: number;
	  }
	| {
			type: 'user-left';
			userId: string;
			username: string;
			userCount: number;
			timestamp: number;
	  }
	| { type: 'error'; message: string }
	| { type: 'draw'; data: DrawData; userId: string; timestamp: number }
	| { type: 'clear'; userId: string; timestamp: number }
	| { type: 'undo'; strokeId: string | null; userId: string; timestamp: number }
	| { type: 'redo'; data: StrokeData; userId: string; timestamp: number }
	| { type: 'cursor'; data: DrawData; userId: string; timestamp: number }
	| { type: 'history-sync'; data: StrokeData[]; timestamp: number }
	| {
			type: 'stroke-finished';
			data: StrokeData;
			userId: string;
			timestamp: number;
	  };

interface UseWebSocketReturn {
	isConnected: boolean;
	isConnecting: boolean;
	userId: string | null;
	username: string | null;
	userCount: number;
	sendDraw: (data: DrawData) => void;
	sendCursor: (data: DrawData) => void;
	// sendClear: () => void;
	sendUndo: (strokeId?: string) => void;
	sendRedo: () => void;
	sendStrokeFinish: (data: StrokeData) => void;
	onMessage: (callback: (message: ServerMessage) => void) => () => void;
}

export function useWebSocket(
	isLoggedIn: boolean = false,
	roomId?: string
): UseWebSocketReturn {
	const [isConnected, setIsConnected] = useState(false);
	const [isConnecting, setIsConnecting] = useState(false);
	const [userId, setUserId] = useState<string | null>(null);
	const [username, setUsername] = useState<string | null>(null);
	const [userCount, setUserCount] = useState(0);

	const socketRef = useRef<BoardSocket | null>(null);
	const reconnectTimeoutRef = useRef<number | undefined>(undefined);
	const messageCallbacksRef = useRef<Set<(message: ServerMessage) => void>>(
		new Set()
	);

	useEffect(() => {
		// 只要有 roomId，无论是否登录都应该连接
		if (!roomId) {
			if (socketRef.current) {
				try {
					socketRef.current.close?.();
				} catch (e) {
					console.error('关闭 WebSocket 连接失败:', e);
				}
				socketRef.current = null;
			}
			// 重置状态
			setTimeout(() => {
				setIsConnected(false);
				setUserId(null);
				setUsername(null);
				setUserCount(0);
			}, 0);
			return;
		}

		function connectWebSocket() {
			try {
				console.log('尝试连接 WebSocket... 房间:', roomId);
				setIsConnecting(true);
				const ws = wsApi.connect(roomId as string);
				socketRef.current = ws;
				console.log('WebSocket 连接已创建');

				setIsConnected(true);
				setIsConnecting(false);
				if (reconnectTimeoutRef.current) {
					clearTimeout(reconnectTimeoutRef.current);
					reconnectTimeoutRef.current = undefined;
				}

				ws.on('close', () => {
					console.log('WebSocket 连接关闭');
					setIsConnected(false);
					setIsConnecting(false);
					socketRef.current = null;

					if (!reconnectTimeoutRef.current) {
						reconnectTimeoutRef.current = window.setTimeout(() => {
							console.log('尝试重新连接...');
							connectWebSocket();
						}, 5000);
					}
				});

				ws.on('error', (error) => {
					console.error('WebSocket 错误:', error);
					setIsConnected(false);
					setIsConnecting(false);
					socketRef.current = null;
				});

				ws.subscribe((event) => {
					const message = event.data as ServerMessage;

					// 过滤掉高频日志，只打印关键信息
					if (message.type !== 'draw' && message.type !== 'cursor') {
						console.log('收到系统消息:', message);
					}

					messageCallbacksRef.current.forEach((callback) => {
						callback(message);
					});

					switch (message.type) {
						case 'connected':
							setUserId(message.userId);
							setUsername(message.username);
							break;

						case 'user-joined':
						case 'user-left':
							setUserCount(message.userCount);
							break;

						// history-sync 交给组件层（Whiteboard.tsx）通过 onMessage 处理
					}
				});
			} catch (error) {
				console.error('创建 WebSocket 连接失败:', error);
				setIsConnected(false);
				if (!reconnectTimeoutRef.current) {
					reconnectTimeoutRef.current = window.setTimeout(() => {
						connectWebSocket();
					}, 5000);
				}
			}
		}

		connectWebSocket();

		return () => {
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
			if (socketRef.current) {
				try {
					socketRef.current.close?.();
				} catch (e) {
					console.error('关闭 WebSocket 连接失败:', e);
				}
			}
		};
	}, [isLoggedIn, roomId]);

	const sendDraw = useCallback(
		(data: DrawData) => {
			if (socketRef.current && isConnected) {
				wsApi.sendDraw(socketRef.current, data);
			}
		},
		[isConnected]
	);

	const sendStrokeFinish = useCallback(
		(data: StrokeData) => {
			if (socketRef.current && isConnected) {
				socketRef.current.send({
					type: 'stroke-finish',
					data: data,
				});
				console.log(
					'已发送笔画保存请求:',
					data.id,
					'点数:',
					data.points.length
				);
			}
		},
		[isConnected]
	);

	const sendCursor = useCallback(
		(data: DrawData) => {
			if (socketRef.current && isConnected) {
				wsApi.sendCursor(socketRef.current, data);
			}
		},
		[isConnected]
	);

	// const sendClear = useCallback(() => {
	//   if (socketRef.current && isConnected) {
	//     wsApi.sendClear(socketRef.current);
	//   }
	// }, [isConnected]);

	const sendUndo = useCallback(
		(strokeId?: string) => {
			if (socketRef.current && isConnected) {
				wsApi.sendUndo(socketRef.current, strokeId);
			}
		},
		[isConnected]
	);

	const sendRedo = useCallback(() => {
		if (socketRef.current && isConnected) {
			wsApi.sendRedo(socketRef.current);
		}
	}, [isConnected]);

	const onMessage = useCallback(
		(callback: (message: ServerMessage) => void) => {
			messageCallbacksRef.current.add(callback);
			return () => {
				messageCallbacksRef.current.delete(callback);
			};
		},
		[]
	);

	return {
		isConnected,
		isConnecting,
		userId,
		username,
		userCount,
		sendDraw,
		sendCursor,
		// sendClear,
		sendUndo,
		sendRedo,
		sendStrokeFinish,
		onMessage,
	};
}
