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
const roundTimers = new Map<string, NodeJS.Timeout>();

// WebSocket 连接引用（用于广播）
const roomConnections = new Map<string, Set<WebSocket>>();

export const gameRoute = new Elysia()
	.use(optionalAuth)
	.derive(() => ({ connectionId: crypto.randomUUID() }))
	.ws('/ws/guess-draw', {
		query: t.Object({ roomId: t.String() }),
		body: GameMessageSchema,

		async open(ws) {
			const { user } = ws.data;
			const userId = user.id.toString();
			const username = user.name;
			const { roomId } = ws.data.query;

			console.log(`用户 ${username}(${userId}) 加入房间 ${roomId}`);

			// 先订阅房间（非常重要！）
			ws.subscribe(roomId);

			// 保存连接引用
			if (!roomConnections.has(roomId)) {
				roomConnections.set(roomId, new Set());
			}
			roomConnections.get(roomId)!.add(ws);

			// 添加用户到房间
			if (!roomUsers.has(roomId)) {
				roomUsers.set(roomId, new Set());
			}
			const room = roomUsers.get(roomId)!;
			room.add(userId);

			// 发送连接确认给当前用户
			ws.send({
				type: 'connected',
				userId,
				username,
				roomId,
				timestamp: Date.now(),
			});

			// 获取或创建游戏状态
			let gameState = roomGames.get(roomId);
			if (!gameState) {
				console.log(`创建新游戏状态: ${roomId}`);
				const roomUserIds = Array.from(room);
				gameState = {
					mode: 'guess-draw',
					isActive: false,
					currentRound: 0,
					totalRounds: 3,
					currentDrawer: null,
					currentWord: null,
					wordHint: null,
					roundStartTime: null,
					roundTimeLimit: 60,
					players: roomUserIds.map((id: string) => ({
						userId: id,
						username: id === userId ? username : '',
						score: 0,
						hasGuessed: false,
						isDrawing: false,
					})),
					usedWords: [],
				};
				roomGames.set(roomId, gameState);
			}

			// 检查是否是新玩家
			const existingPlayer = gameState.players.find(
				(p: GamePlayer) => p.userId === userId
			);
			if (!existingPlayer) {
				console.log(`新玩家加入: ${username}(${userId})`);
				gameState.players.push({
					userId,
					username,
					score: 0,
					hasGuessed: false,
					isDrawing: false,
				});
			} else {
				console.log(`更新现有玩家信息: ${username}(${userId})`);
				existingPlayer.username = username;
			}

			// 发送当前游戏状态给新连接的用户
			ws.send({
				type: 'game-state',
				data: gameState,
				timestamp: Date.now(),
			});

			// 广播用户加入消息
			ws.publish(roomId, {
				type: 'user-joined',
				userId,
				username,
				userCount: room.size,
				timestamp: Date.now(),
			});

			// 广播更新后的游戏状态
			ws.publish(roomId, {
				type: 'game-state',
				data: gameState,
				timestamp: Date.now(),
			});
		},

		async message(ws, message) {
			const { user } = ws.data;
			const userId = user.id.toString();
			const username = user.name;
			const { roomId } = ws.data.query;

			// 处理游戏启动
			if (message.type === 'game-start') {
				console.log(`用户 ${username} 请求开始游戏`);
				try {
					const existingGameState = roomGames.get(roomId);

					// 如果游戏已经在进行中，忽略
					if (existingGameState && existingGameState.isActive) {
						console.log('游戏已在进行中，忽略启动请求');
						return;
					}

					const totalRounds = message.totalRounds || 3;
					const currentRoom = roomUsers.get(roomId);

					if (!currentRoom || currentRoom.size < 1) {
						ws.send({
							type: 'error',
							message: '房间内没有玩家',
							timestamp: Date.now(),
						});
						return;
					}

					// 检查至少需要2个玩家才能开始游戏
					if (currentRoom.size < 2) {
						ws.send({
							type: 'error',
							message: '至少需要2个玩家才能开始游戏',
							timestamp: Date.now(),
						});
						return;
					}

					// 准备玩家列表
					let players: GamePlayer[];
					if (existingGameState) {
						// 过滤出当前在线的玩家
						players = existingGameState.players.filter((p) =>
							currentRoom.has(p.userId)
						);
						// 更新当前用户的用户名
						const currentUser = players.find((p) => p.userId === userId);
						if (currentUser) {
							currentUser.username = username;
						}
					} else {
						players = Array.from(currentRoom).map((id) => ({
							userId: id,
							username: id === userId ? username : '',
							score: 0,
							hasGuessed: false,
							isDrawing: false,
						}));
					}

					// 重置所有玩家状态
					players.forEach((p) => {
						p.score = 0;
						p.hasGuessed = false;
						p.isDrawing = false;
					});

					console.log(
						`游戏开始，玩家数: ${players.length}, 回合数: ${totalRounds}`
					);

					// 创建新游戏状态
					const newGameState: GameState = {
						mode: 'guess-draw',
						isActive: true,
						currentRound: 0,
						totalRounds,
						currentDrawer: null,
						currentWord: null,
						wordHint: null,
						roundStartTime: null,
						roundTimeLimit: 60,
						players,
						usedWords: [],
					};

					roomGames.set(roomId, newGameState);

					console.log('发送游戏开始通知');

					// 游戏开始通知
					const gameStartMsg = {
						type: 'game-started',
						totalRounds,
						playerCount: players.length,
						timestamp: Date.now(),
					};
					broadcastToAll(roomId, gameStartMsg);

					// 初始游戏状态
					const initialStateMsg = {
						type: 'game-state',
						data: newGameState,
						timestamp: Date.now(),
					};
					broadcastToAll(roomId, initialStateMsg);

					// 延迟启动第一轮，确保所有客户端都收到状态
					setTimeout(() => {
						console.log('延迟后启动第一轮');
						startNewRound(roomId, ws);
					}, 1500);
				} catch (e) {
					console.error('开始游戏失败:', e);
					ws.send({
						type: 'error',
						message: '开始游戏失败',
						timestamp: Date.now(),
					});
				}
				return;
			}

			const gameState = roomGames.get(roomId);
			if (!gameState) {
				console.log('游戏状态不存在');
				return;
			}

			switch (message.type) {
				case 'guess-attempt':
					console.log(`${username} 尝试猜测: ${message.guess}`);
					try {
						// 画者不能猜词
						if (gameState.currentDrawer === userId) {
							console.log('画者不能猜词');
							break;
						}

						const guess = message.guess?.toLowerCase().trim();
						const currentWord = gameState.currentWord?.toLowerCase();

						if (!guess || !currentWord) {
							console.log('猜测或答案为空');
							break;
						}

						const isCorrect = guess === currentWord;
						const player = gameState.players.find(
							(p: GamePlayer) => p.userId === userId
						);

						if (!player) {
							console.log('找不到玩家');
							break;
						}

						if (player.hasGuessed) {
							console.log('玩家已经猜过了');
							break;
						}

						if (isCorrect) {
							console.log(`${username} 猜对了！`);
							player.hasGuessed = true;

							// 计算得分（基于剩余时间）
							const elapsed =
								(Date.now() - (gameState.roundStartTime || 0)) / 1000;
							const timeBonus = Math.max(0, gameState.roundTimeLimit - elapsed);
							const score = Math.floor(100 + timeBonus * 2);
							player.score += score;

							console.log(`${username} 获得 ${score} 分`);

							// 清除当前回合的计时器
							clearRoundTimer(roomId);

							// 广播猜对消息
							const correctMsg = {
								type: 'guess-correct',
								userId,
								username: player.username,
								word: gameState.currentWord,
								score,
								timestamp: Date.now(),
							};
							broadcastToAll(roomId, correctMsg);

							// 广播更新后的游戏状态
							const updatedStateMsg = {
								type: 'game-state',
								data: gameState,
								timestamp: Date.now(),
							};
							broadcastToAll(roomId, updatedStateMsg);

							// 延迟3秒后开始下一轮
							setTimeout(() => {
								console.log('有人猜对，3秒后开始下一轮');
								startNewRound(roomId, ws);
							}, 3000);
						} else {
							console.log(`${username} 猜错了: ${message.guess}`);
							// 广播错误的猜测
							ws.publish(roomId, {
								type: 'guess-attempt',
								attempt: {
									userId,
									username: player.username,
									guess: message.guess,
									isCorrect: false,
									timestamp: Date.now(),
								},
								timestamp: Date.now(),
							});
						}
					} catch (e) {
						console.error('处理猜词失败:', e);
					}
					break;

				case 'game-chat':
					try {
						const player = gameState.players.find(
							(p: GamePlayer) => p.userId === userId
						);
						const senderUsername = player?.username || username;

						console.log(`聊天消息: ${senderUsername}: ${message.message}`);

						ws.publish(roomId, {
							type: 'game-chat',
							message: message.message,
							userId,
							username: senderUsername,
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
							type: message.type,
							data: message.data,
							userId,
							timestamp: Date.now(),
						});
					} else {
						console.log(`非画者 ${username} 尝试绘画`);
					}
					break;

				default:
					console.log(`未知消息类型: ${message.type}`);
			}
		},

		close(ws) {
			const { user } = ws.data;
			const userId = user.id.toString();
			const username = user.name;
			const { roomId } = ws.data.query;

			console.log(`用户 ${username}(${userId}) 离开房间 ${roomId}`);

			// 移除连接引用
			const connections = roomConnections.get(roomId);
			if (connections) {
				connections.delete(ws);
				if (connections.size === 0) {
					roomConnections.delete(roomId);
				}
			}

			const room = roomUsers.get(roomId);
			if (!room) return;

			room.delete(userId);

			const gameState = roomGames.get(roomId);
			let playerUsername = username;

			if (gameState) {
				const leavingPlayer = gameState.players.find(
					(p: GamePlayer) => p.userId === userId
				);
				if (leavingPlayer && leavingPlayer.username) {
					playerUsername = leavingPlayer.username;
				}

				// 从游戏状态中移除玩家
				gameState.players = gameState.players.filter(
					(p: GamePlayer) => p.userId !== userId
				);

				// 如果离开的是画者，结束当前回合
				if (gameState.currentDrawer === userId && gameState.isActive) {
					console.log('画者离开，结束当前回合');
					clearRoundTimer(roomId);

					const roundEndMsg = {
						type: 'round-end',
						winner: null,
						word: gameState.currentWord || '',
						reason: 'drawer-left',
						timestamp: Date.now(),
					};
					broadcastToAll(roomId, roundEndMsg);

					setTimeout(() => startNewRound(roomId, ws), 2000);
				}
			}

			// 广播用户离开消息
			const userLeftMsg = {
				type: 'user-left',
				userId,
				username: playerUsername,
				userCount: room.size,
				timestamp: Date.now(),
			};
			broadcastToAll(roomId, userLeftMsg);

			// 检查是否只剩一个人，如果是则让那个人胜利
			if (gameState && gameState.isActive && room.size === 1) {
				console.log('房间只剩一个人，宣布胜利者');
				const remainingPlayerId = Array.from(room)[0];
				const remainingPlayer = gameState.players.find(
					(p: GamePlayer) => p.userId === remainingPlayerId
				);

				if (remainingPlayer) {
					// 给胜利者加分
					remainingPlayer.score += 500; // 胜利奖励分

					// 广播胜利消息
					const victoryMsg = {
						type: 'game-end',
						winner: remainingPlayerId,
						winnerName: remainingPlayer.username,
						reason: 'last-player-standing',
						finalScores: gameState.players.sort((a, b) => b.score - a.score),
						timestamp: Date.now(),
					};
					broadcastToAll(roomId, victoryMsg);

					// 清理游戏状态
					roomGames.delete(roomId);
					clearRoundTimer(roomId);

					// 创建重置的游戏状态并广播
					const resetGameState: GameState = {
						mode: 'guess-draw',
						isActive: false,
						currentRound: 0,
						totalRounds: gameState.totalRounds,
						currentDrawer: null,
						currentWord: null,
						wordHint: null,
						roundStartTime: null,
						roundTimeLimit: gameState.roundTimeLimit,
						players: gameState.players.map((p) => ({
							...p,
							hasGuessed: false,
							isDrawing: false,
						})),
						usedWords: [],
					};

					const resetStateMsg = {
						type: 'game-state',
						data: resetGameState,
						timestamp: Date.now(),
					};
					broadcastToAll(roomId, resetStateMsg);
					return; // 不再执行下面的广播
				}
			}

			// 广播更新后的游戏状态
			if (gameState) {
				const updatedStateMsg = {
					type: 'game-state',
					data: gameState,
					timestamp: Date.now(),
				};
				broadcastToAll(roomId, updatedStateMsg);
			}

			// 如果房间空了，清理资源
			if (room.size === 0) {
				console.log(`房间 ${roomId} 已空，清理资源`);
				roomUsers.delete(roomId);
				roomGames.delete(roomId);
				clearRoundTimer(roomId);
			}

			ws.unsubscribe(roomId);
		},
	});

// ==================== 游戏逻辑函数 ====================

// 广播消息给房间内所有人（确保每个人都收到）
function broadcastToAll(roomId: string, message: Record<string, unknown>) {
	const connections = roomConnections.get(roomId);
	if (!connections || connections.size === 0) {
		console.log(`警告：房间 ${roomId} 没有活跃连接`);
		return;
	}

	console.log(
		`向房间 ${roomId} 的 ${connections.size} 个连接发送消息:`,
		message.type
	);

	// 直接向每个连接发送消息，确保所有人都收到
	connections.forEach((ws) => {
		try {
			ws.send(message);
		} catch (error) {
			console.error('发送消息失败:', error);
		}
	});
}

function startNewRound(
	roomId: string,
	ws: {
		publish: (roomId: string, message: Record<string, unknown>) => void;
		data: { user?: { id?: number | string; name?: string } };
	}
) {
	const gameState = roomGames.get(roomId);
	if (!gameState) {
		console.log('游戏状态不存在，无法开始新回合');
		return;
	}

	const currentRoom = roomUsers.get(roomId);
	if (!currentRoom || currentRoom.size < 1) {
		console.log('房间内没有玩家，结束游戏');
		endGame(roomId, ws);
		return;
	}

	// 递增回合数
	gameState.currentRound++;
	console.log(`\n========== 开始第 ${gameState.currentRound} 回合 ==========`);

	// 检查是否游戏结束
	if (gameState.currentRound > gameState.totalRounds) {
		console.log('所有回合已完成，游戏结束');
		endGame(roomId, ws);
		return;
	}

	// 获取当前在线的玩家
	const players = gameState.players.filter((p: GamePlayer) =>
		currentRoom.has(p.userId)
	);
	if (players.length === 0) {
		console.log('没有可用玩家，结束游戏');
		endGame(roomId, ws);
		return;
	}

	console.log(`当前在线玩家: ${players.map((p) => p.username).join(', ')}`);

	// 选择下一个画者
	let drawerIndex = 0;
	if (gameState.currentDrawer) {
		const currentIndex = players.findIndex(
			(p: GamePlayer) => p.userId === gameState.currentDrawer
		);
		if (currentIndex >= 0) {
			drawerIndex = (currentIndex + 1) % players.length;
		}
	}

	const newDrawer = players[drawerIndex];
	if (!newDrawer) {
		console.error('无法选择画者');
		endGame(roomId, ws);
		return;
	}

	console.log(`选择画者: ${newDrawer.username}(${newDrawer.userId})`);

	// 重置所有玩家状态
	gameState.players.forEach((p: GamePlayer) => {
		p.hasGuessed = false;
		p.isDrawing = p.userId === newDrawer.userId;
	});

	console.log('玩家状态:');
	gameState.players.forEach((p) => {
		console.log(
			`  - ${p.username}(${p.userId}): isDrawing=${p.isDrawing}, hasGuessed=${p.hasGuessed}`
		);
	});

	// 选择新词
	const availableWords = WORD_LIBRARY.filter(
		(word: string) => !gameState.usedWords.includes(word)
	);
	let newWord: string;

	if (availableWords.length > 0) {
		const randomIndex = Math.floor(Math.random() * availableWords.length);
		newWord = availableWords[randomIndex];
	} else {
		console.log('词库已用完，重置');
		gameState.usedWords = [];
		newWord = WORD_LIBRARY[Math.floor(Math.random() * WORD_LIBRARY.length)];
	}

	gameState.usedWords.push(newWord);
	console.log(`选择词汇: ${newWord}`);

	// 生成提示（隐藏部分字符）
	const hintChars = newWord
		.split('')
		.map((char: string, index: number) => (index % 2 === 0 ? char : '_'));
	const wordHint = hintChars.join('');

	// 更新游戏状态
	gameState.currentDrawer = newDrawer.userId;
	gameState.currentWord = newWord;
	gameState.wordHint = wordHint;
	gameState.roundStartTime = Date.now();

	console.log(`提示: ${wordHint}`);
	console.log(
		`回合开始时间: ${new Date(gameState.roundStartTime).toLocaleTimeString()}`
	);

	// 发送完整的游戏状态（最重要！）
	const completeState = {
		type: 'game-state',
		data: {
			...gameState,
			isActive: true,
			currentRound: gameState.currentRound,
			currentDrawer: gameState.currentDrawer,
			wordHint: gameState.wordHint,
			roundStartTime: gameState.roundStartTime,
			roundTimeLimit: gameState.roundTimeLimit,
		},
		timestamp: Date.now(),
	};

	console.log('发送游戏状态给所有人');
	broadcastToAll(roomId, completeState);

	// 发送回合开始通知（用于UI提示和动画）
	const roundStartMsg = {
		type: 'round-start',
		currentRound: gameState.currentRound,
		totalRounds: gameState.totalRounds,
		currentDrawer: gameState.currentDrawer,
		drawerUsername: newDrawer.username,
		wordHint: gameState.wordHint,
		roundStartTime: gameState.roundStartTime,
		roundTimeLimit: gameState.roundTimeLimit,
		timestamp: Date.now(),
	};

	console.log('发送回合开始通知');
	broadcastToAll(roomId, roundStartMsg);

	// 设置回合定时器
	clearRoundTimer(roomId);
	const timer = setTimeout(() => {
		console.log(`回合 ${gameState.currentRound} 时间到`);
		const currentGame = roomGames.get(roomId);
		if (currentGame && currentGame.currentRound === gameState.currentRound) {
			const timeoutMsg = {
				type: 'round-end',
				winner: null,
				word: gameState.currentWord,
				reason: 'timeout',
				timestamp: Date.now(),
			};
			broadcastToAll(roomId, timeoutMsg);

			setTimeout(() => {
				console.log('时间到，3秒后开始下一轮');
				startNewRound(roomId, ws);
			}, 3000);
		}
	}, gameState.roundTimeLimit * 1000);

	roundTimers.set(roomId, timer);
	console.log(`设置 ${gameState.roundTimeLimit} 秒定时器`);
	console.log('====================================\n');
}

function endGame(
	roomId: string,
	ws: {
		publish: (roomId: string, message: Record<string, unknown>) => void;
		data: { user?: { id?: number | string; name?: string } };
	}
) {
	console.log(`\n========== 游戏结束: ${roomId} ==========`);
	const gameState = roomGames.get(roomId);
	if (!gameState) return;

	// 清除定时器
	clearRoundTimer(roomId);

	// 标记游戏结束
	gameState.isActive = false;

	// 按分数排序
	const finalScores = gameState.players.sort(
		(a: GamePlayer, b: GamePlayer) => b.score - a.score
	);

	console.log('最终排名:');
	finalScores.forEach((p, i) => {
		console.log(`  ${i + 1}. ${p.username}: ${p.score}分`);
	});

	const endMsg = {
		type: 'game-end',
		finalScores,
		timestamp: Date.now(),
	};
	broadcastToAll(roomId, endMsg);

	// 广播最终游戏状态
	const finalStateMsg = {
		type: 'game-state',
		data: gameState,
		timestamp: Date.now(),
	};
	broadcastToAll(roomId, finalStateMsg);

	console.log('====================================\n');
}

function clearRoundTimer(roomId: string) {
	const timer = roundTimers.get(roomId);
	if (timer) {
		clearTimeout(timer);
		roundTimers.delete(roomId);
		console.log(`清除房间 ${roomId} 的定时器`);
	}
}
