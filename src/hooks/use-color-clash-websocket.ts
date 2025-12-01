import { useEffect, useRef, useState, useCallback } from 'react';
import { colorClashWsApi } from '@/api/ws/color-clash';
import type { ColorClashDrawMessage } from '@/api/ws/color-clash';
import type { ColorClashServerMessage } from '@/api/color-clash';

type ColorClashSocket = ReturnType<typeof colorClashWsApi.connect>;

type ServerMessage = ColorClashServerMessage;

type MessageListener = (message: ServerMessage) => void;

/**
 * 图色冲突游戏 WebSocket Hook
 * 管理 WebSocket 连接、消息分发、发送指令
 */
export function useColorClashWebSocket(enabled: boolean, roomId?: string) {
	const [isConnected, setIsConnected] = useState(false);
	const [isConnecting, setIsConnecting] = useState(false);

	const socketRef = useRef<ColorClashSocket | null>(null);
	const listenersRef = useRef<Set<MessageListener>>(new Set());
	const reconnectTimeoutRef = useRef<number | undefined>(undefined);

	useEffect(() => {
		if (!enabled || !roomId) {
			return;
		}

		function connect() {
			try {
				setIsConnecting(true);
				const ws = colorClashWsApi.connect(roomId!);
				socketRef.current = ws;

				setIsConnected(true);
				setIsConnecting(false);
				if (reconnectTimeoutRef.current) {
					clearTimeout(reconnectTimeoutRef.current);
					reconnectTimeoutRef.current = undefined;
				}

				ws.subscribe((event: MessageEvent | { data: ServerMessage }) => {
					try {
						const message = (event as MessageEvent).data as ServerMessage;

						// 分发给监听器
						listenersRef.current.forEach((listener) => {
							listener(message);
						});
					} catch (error) {
						console.error(
							'Failed to parse ColorClashWebSocket message:',
							error
						);
					}
				});
			} catch (error) {
				console.error('Failed to connect ColorClashWebSocket:', error);
				setIsConnecting(false);

				if (!reconnectTimeoutRef.current) {
					reconnectTimeoutRef.current = window.setTimeout(() => {
						connect();
					}, 3000) as unknown as number;
				}
			}
		}

		connect();

		return () => {
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
			if (socketRef.current?.close) {
				socketRef.current.close();
			}
			socketRef.current = null;
		};
	}, [enabled, roomId]);

	const sendDraw = useCallback(
		(data: ColorClashDrawMessage['data']) => {
			if (socketRef.current && isConnected) {
				colorClashWsApi.sendDraw(socketRef.current, data);
			}
		},
		[isConnected]
	);

	const sendGameStart = useCallback(() => {
		if (socketRef.current && isConnected) {
			colorClashWsApi.sendGameStart(socketRef.current);
		}
	}, [isConnected]);

	const sendGameChat = useCallback(
		(data: { message: string; username: string; id?: string }) => {
			if (socketRef.current && isConnected) {
				colorClashWsApi.sendGameChat(socketRef.current, data);
			}
		},
		[isConnected]
	);

	const sendPing = useCallback(() => {
		if (socketRef.current && isConnected) {
			colorClashWsApi.sendPing(socketRef.current);
		}
	}, [isConnected]);

	const onMessage = useCallback((callback: MessageListener) => {
		listenersRef.current.add(callback);
		return () => {
			listenersRef.current.delete(callback);
		};
	}, []);

	return {
		isConnected,
		isConnecting,
		sendDraw,
		sendGameStart,
		sendGameChat,
		sendPing,
		onMessage,
	};
}
