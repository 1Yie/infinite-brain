import { useEffect, useRef, useState, useCallback } from 'react';
import { guessDrawWsApi } from '@/api/guess-draw';
import type { GuessDrawClientMessage, DrawMessage } from '@/api/guess-draw';

type GuessDrawSocket = ReturnType<typeof guessDrawWsApi.connect>;

type ServerMessage = GuessDrawClientMessage;

type MessageListener = (message: ServerMessage) => void;

/**
 * 你猜我画游戏 WebSocket Hook
 * 管理 WebSocket 连接、消息分发、发送指令
 */
export function useGuessDrawWebSocket(enabled: boolean, roomId?: string) {
	const [isConnected, setIsConnected] = useState(false);
	const [isConnecting, setIsConnecting] = useState(false);

	const socketRef = useRef<GuessDrawSocket | null>(null);
	const listenersRef = useRef<Set<MessageListener>>(new Set());
	const reconnectTimeoutRef = useRef<number | undefined>(undefined);

	useEffect(() => {
		if (!enabled || !roomId) {
			return;
		}

		function connect() {
			try {
				setIsConnecting(true);
				const ws = guessDrawWsApi.connect(roomId!);
				socketRef.current = ws;

				setIsConnected(true);
				setIsConnecting(false);
				if (reconnectTimeoutRef.current) {
					clearTimeout(reconnectTimeoutRef.current);
					reconnectTimeoutRef.current = undefined;
				}

				ws.subscribe((event: MessageEvent | { data: ServerMessage }) => {
					try {
						const message = (
							'data' in event ? event.data : event
						) as ServerMessage;

						// 分发给监听器
						listenersRef.current.forEach((listener) => {
							listener(message);
						});
					} catch (error) {
						console.error('Failed to parse GuessDrawWebSocket message:', error);
					}
				});
			} catch (error) {
				console.error('Failed to connect GuessDrawWebSocket:', error);
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
		(data: unknown) => {
			if (socketRef.current && isConnected) {
				guessDrawWsApi.sendDraw(socketRef.current, data as DrawMessage['data']);
			}
		},
		[isConnected]
	);

	const sendStrokeFinish = useCallback(
		(data: unknown) => {
			if (socketRef.current && isConnected) {
				guessDrawWsApi.sendStrokeFinish(
					socketRef.current,
					data as DrawMessage['data']
				);
			}
		},
		[isConnected]
	);

	const sendClear = useCallback(() => {
		if (socketRef.current && isConnected) {
			guessDrawWsApi.sendClear(socketRef.current);
		}
	}, [isConnected]);

	const sendGuess = useCallback(
		(guess: string) => {
			if (socketRef.current && isConnected) {
				guessDrawWsApi.sendGuess(socketRef.current, guess);
			}
		},
		[isConnected]
	);

	const sendGameStart = useCallback(
		(totalRounds?: number, roundTimeLimit?: number) => {
			if (socketRef.current && isConnected) {
				guessDrawWsApi.sendGameStart(
					socketRef.current,
					totalRounds,
					roundTimeLimit
				);
			}
		},
		[isConnected]
	);

	const sendGameChat = useCallback(
		(message: string) => {
			if (socketRef.current && isConnected) {
				guessDrawWsApi.sendGameChat(socketRef.current, message);
			}
		},
		[isConnected]
	);

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
		sendStrokeFinish,
		sendClear,
		sendGuess,
		sendGameStart,
		sendGameChat,
		onMessage,
	};
}
