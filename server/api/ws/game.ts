import { Elysia, t } from 'elysia';
import { optionalAuth } from '../../utils/verify';
import {
	GameMessageSchema,
	WORD_LIBRARY,
	type GameState,
	type GamePlayer,
} from '../../types';

const roomUsers = new Map<string, Set<string>>();
const roomGames = new Map<string, GameState>();

export const gameRoute = new Elysia({ prefix: '/ws' })
	.use(optionalAuth)
	.derive(() => ({ connectionId: crypto.randomUUID() }))
	.ws('/guess-draw', {
		query: t.Object({ roomId: t.String() }),
		body: GameMessageSchema,

		async open(ws) {
			const { user } = ws.data;
			const userId = user.id.toString();
			const username = user.name;
			const { roomId } = ws.data.query;

			if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Set());
			roomUsers.get(roomId)!.add(userId);
			ws.subscribe(roomId);

			ws.send({
				type: 'connected',
				userId,
				username,
				roomId,
				timestamp: Date.now(),
			});

			// 发送当前游戏状态
			const gameState = roomGames.get(roomId);
			if (gameState) {
				ws.send({
					type: 'game-state',
					data: gameState,
					timestamp: Date.now(),
				});
			}

			ws.publish(roomId, {
				type: 'user-joined',
				userId,
				username,
				userCount: roomUsers.get(roomId)!.size,
				timestamp: Date.now(),
			});
		},

		async message(ws, message) {
			const { user } = ws.data;
			const userId = user.id.toString();
			const username = user.name;
			const { roomId } = ws.data.query;

			// 游戏启动消息可以在没有 gameState 时处理
			if (message.type === 'game-start') {
				try {
					const totalRounds = message.totalRounds || 3;
					const currentRoom = roomUsers.get(roomId);
					if (!currentRoom || currentRoom.size < 2) {
						ws.send({
							type: 'error',
							message: '需要至少2名玩家才能开始游戏',
							timestamp: Date.now(),
						});
						return;
					}

					// 初始化游戏状态
					const players: GamePlayer[] = Array.from(currentRoom).map(
						(userId) => ({
							userId,
							username: '', // 稍后填充
							score: 0,
							hasGuessed: false,
							isDrawing: false,
						})
					);

					const newGameState: GameState = {
						mode: 'guess-draw',
						isActive: true,
						currentRound: 1,
						totalRounds,
						currentDrawer: null,
						currentWord: null,
						wordHint: null,
						roundStartTime: null,
						roundTimeLimit: 60, // 60秒
						players,
						usedWords: [],
					};

					roomGames.set(roomId, newGameState);
					startNewRound(roomId, ws);
				} catch (e) {
					console.error('开始游戏失败:', e);
				}
				return;
			}

			const gameState = roomGames.get(roomId);
			if (!gameState) {
				return;
			}

			switch (message.type) {
				case 'guess-attempt':
					try {
						if (
							!gameState ||
							!gameState.isActive ||
							gameState.currentDrawer === userId
						) {
							break; // 画者不能猜词
						}

						const guess = message.guess?.toLowerCase().trim();
						const currentWord = gameState.currentWord?.toLowerCase();

						if (!guess || !currentWord) break;

						const isCorrect = guess === currentWord;
						const player = gameState.players.find(
							(p: GamePlayer) => p.userId === userId
						);

						if (player && !player.hasGuessed) {
							player.hasGuessed = true;

							if (isCorrect) {
								// 计算得分（基于剩余时间）
								const elapsed =
									(Date.now() - (gameState.roundStartTime || 0)) / 1000;
								const timeBonus = Math.max(
									0,
									gameState.roundTimeLimit - elapsed
								);
								player.score += Math.floor(100 + timeBonus * 2);

								// 广播猜对消息
								ws.publish(roomId, {
									type: 'round-end',
									winner: userId,
									word: gameState.currentWord || '',
									timestamp: Date.now(),
								});

								// 延迟开始下一轮
								setTimeout(() => startNewRound(roomId, ws), 3000);
							} else {
								// 广播猜词尝试
								ws.publish(roomId, {
									type: 'guess-attempt',
									attempt: {
										userId,
										username,
										guess: message.guess,
										isCorrect: false,
										timestamp: Date.now(),
									},
									timestamp: Date.now(),
								});
							}
						}
					} catch (e) {
						console.error('处理猜词失败:', e);
					}
					break;

				case 'game-chat':
					try {
						// 广播聊天消息
						ws.publish(roomId, {
							type: 'game-chat',
							message: message.message,
							userId,
							username,
							timestamp: Date.now(),
						});
					} catch (e) {
						console.error('发送聊天消息失败:', e);
					}
					break;

				case 'draw':
				case 'stroke-finish':
				case 'clear':
					// 只有当前画者才能发送绘画数据
					if (gameState.currentDrawer === userId) {
						ws.publish(roomId, {
							...message,
							userId,
							timestamp: Date.now(),
						});
					}
					break;
			}
		},

		close(ws) {
			const { user } = ws.data;
			const userId = user.id.toString();
			const username = user.name;
			const { roomId } = ws.data.query;

			const room = roomUsers.get(roomId);
			if (room) {
				room.delete(userId);
				if (room.size === 0) roomUsers.delete(roomId);
				ws.unsubscribe(roomId);
				ws.publish(roomId, {
					type: 'user-left',
					userId,
					username,
					userCount: room.size,
					timestamp: Date.now(),
				});
			}
		},
	});

// 游戏相关函数
function startNewRound(
	roomId: string,
	ws: {
		publish: (roomId: string, message: Record<string, unknown>) => void;
		data: { user?: { id?: number | string; name?: string } };
	}
) {
	const gameState = roomGames.get(roomId);
	if (!gameState) return;

	const currentRoom = roomUsers.get(roomId);
	if (!currentRoom || currentRoom.size < 2) {
		endGame(roomId, ws);
		return;
	}

	// 选择下一个画者
	const players = gameState.players.filter((p: GamePlayer) =>
		currentRoom.has(p.userId)
	);
	if (players.length === 0) {
		endGame(roomId, ws);
		return;
	}

	const drawerIndex = gameState.currentDrawer
		? (() => {
				const index = players.findIndex(
					(p: GamePlayer) => p.userId === gameState.currentDrawer
				);
				return index >= 0 ? (index + 1) % players.length : 0;
			})()
		: 0;

	// 确保drawerIndex在有效范围内
	const safeDrawerIndex = Math.min(drawerIndex, players.length - 1);
	const newDrawer = players[safeDrawerIndex];
	if (!newDrawer) {
		console.error('无法选择新的画者');
		endGame(roomId, ws);
		return;
	}

	// 重置玩家状态
	players.forEach((p: GamePlayer) => {
		p.hasGuessed = false;
		p.isDrawing = p.userId === newDrawer.userId;
	});

	// 选择新词
	const availableWords = WORD_LIBRARY.filter(
		(word: string) => !gameState.usedWords.includes(word)
	);
	// 确保有词可选
	let newWord: string;
	if (availableWords.length > 0) {
		const randomIndex = Math.floor(Math.random() * availableWords.length);
		newWord = availableWords[randomIndex] || WORD_LIBRARY[0] || '默认词汇';
	} else {
		// 如果所有词都用过了，重置已用词列表
		gameState.usedWords = [];
		newWord = WORD_LIBRARY[0] || '默认词汇';
	}

	gameState.usedWords.push(newWord);

	// 生成提示（隐藏部分字符）
	const hintChars = newWord
		.split('')
		.map((char: string, index: number) => (index % 2 === 0 ? char : '_'));
	const wordHint = hintChars.join('');

	gameState.currentRound++;
	gameState.currentDrawer = newDrawer.userId;
	gameState.currentWord = newWord;
	gameState.wordHint = wordHint;
	gameState.roundStartTime = Date.now();

	// 检查是否游戏结束
	if (gameState.currentRound > gameState.totalRounds) {
		endGame(roomId, ws);
		return;
	}

	// 广播新回合开始
	const currentDrawerId = gameState.currentDrawer;
	const wsUserId = ws.data.user?.id?.toString();

	ws.publish(roomId, {
		type: 'round-start',
		gameState: {
			...gameState,
			currentWord:
				currentDrawerId === wsUserId ? gameState.currentWord || '' : null,
		},
		timestamp: Date.now(),
	});

	// 设置回合定时器
	setTimeout(() => {
		const currentGame = roomGames.get(roomId);
		if (currentGame && currentGame.currentRound === gameState.currentRound) {
			ws.publish(roomId, {
				type: 'round-end',
				winner: null,
				word: gameState.currentWord || '',
				timestamp: Date.now(),
			});

			setTimeout(() => startNewRound(roomId, ws), 3000);
		}
	}, gameState.roundTimeLimit * 1000);
}

function endGame(
	roomId: string,
	ws: {
		publish: (roomId: string, message: Record<string, unknown>) => void;
		data: { user?: { id?: number | string; name?: string } };
	}
) {
	const gameState = roomGames.get(roomId);
	if (!gameState) return;

	ws.publish(roomId, {
		type: 'game-end',
		finalScores: gameState.players.sort(
			(a: GamePlayer, b: GamePlayer) => b.score - a.score
		),
		timestamp: Date.now(),
	});

	roomGames.delete(roomId);
}
