import { Elysia, t } from 'elysia';
import { optionalAuth } from '../../utils/verify';
import {
	GameMessageSchema,
	WORD_LIBRARY,
	type GameState,
	type GamePlayer,
	type WordEntry,
} from '../../types';
import { db } from '../../db';
import {
	guessDrawRooms,
	guessDrawPlayers,
	guessDrawUsedWords,
} from '../../db/schema';
import { eq, and } from 'drizzle-orm';

const roomUsers = new Map<string, Set<string>>();
const roundTimers = new Map<string, NodeJS.Timeout>();
const roomCleanupTimers = new Map<string, NodeJS.Timeout>();

// WebSocket 连接引用（用于广播）
const roomConnections = new Map<string, Set<WebSocket>>();

// 玩家连接映射：roomId -> (userId -> ws)（用于确定每个连接的用户身份）
const playerConnectionMap = new Map<string, Map<string, WebSocket>>();

// 从数据库获取游戏状态
async function getGameState(roomId: string): Promise<GameState | null> {
	try {
		const room = await db
			.select()
			.from(guessDrawRooms)
			.where(eq(guessDrawRooms.id, roomId))
			.limit(1);

		if (room.length === 0) {
			return null;
		}

		const dbRoom = room[0]!;

		// 获取玩家列表
		const players = await db
			.select()
			.from(guessDrawPlayers)
			.where(eq(guessDrawPlayers.roomId, roomId));

		// 获取已使用的词语
		const usedWords = await db
			.select()
			.from(guessDrawUsedWords)
			.where(eq(guessDrawUsedWords.roomId, roomId));

		const gameState: GameState = {
			mode: 'guess-draw',
			isActive: dbRoom.status === 'playing',
			currentRound: dbRoom.currentRound,
			totalRounds: dbRoom.totalRounds,
			currentDrawer: dbRoom.currentDrawerId,
			currentWord: dbRoom.currentWord,
			wordHint: dbRoom.wordHint,
			roundStartTime: dbRoom.roundStartTime
				? new Date(dbRoom.roundStartTime).getTime()
				: null,
			roundTimeLimit: dbRoom.roundTimeLimit,
			players: players.map((p) => ({
				userId: p.userId,
				username: p.username,
				score: p.score,
				hasGuessed: Boolean(p.hasGuessed),
				isDrawing: Boolean(p.isDrawing),
			})),
			usedWords: usedWords.map((w) => w.word),
		};

		return gameState;
	} catch (error) {
		console.error('Error getting game state:', error);
		return null;
	}
}

// 更新游戏状态到数据库
async function updateGameState(
	roomId: string,
	gameState: Partial<GameState>
): Promise<void> {
	try {
		const updateData: Partial<typeof guessDrawRooms.$inferInsert> = {};

		if (gameState.isActive !== undefined) {
			updateData.status = gameState.isActive ? 'playing' : 'waiting';
		}
		if (gameState.currentRound !== undefined) {
			updateData.currentRound = gameState.currentRound;
		}
		if (gameState.totalRounds !== undefined) {
			updateData.totalRounds = gameState.totalRounds;
		}
		if (gameState.currentDrawer !== undefined) {
			updateData.currentDrawerId = gameState.currentDrawer;
		}
		if (gameState.currentWord !== undefined) {
			updateData.currentWord = gameState.currentWord;
		}
		if (gameState.wordHint !== undefined) {
			updateData.wordHint = gameState.wordHint;
		}
		if (gameState.roundStartTime !== undefined) {
			updateData.roundStartTime = gameState.roundStartTime
				? new Date(gameState.roundStartTime)
				: null;
		}
		if (gameState.roundTimeLimit !== undefined) {
			updateData.roundTimeLimit = gameState.roundTimeLimit;
		}

		if (Object.keys(updateData).length > 0) {
			await db
				.update(guessDrawRooms)
				.set(updateData)
				.where(eq(guessDrawRooms.id, roomId));
		}

		// 更新玩家状态
		if (gameState.players) {
			for (const player of gameState.players) {
				await db
					.update(guessDrawPlayers)
					.set({
						score: player.score,
						hasGuessed: player.hasGuessed,
						isDrawing: player.isDrawing,
					})
					.where(
						and(
							eq(guessDrawPlayers.roomId, roomId),
							eq(guessDrawPlayers.userId, player.userId)
						)
					);
			}
		}

		// 更新已使用的词语
		if (gameState.usedWords) {
			// 先删除现有的
			await db
				.delete(guessDrawUsedWords)
				.where(eq(guessDrawUsedWords.roomId, roomId));

			// 插入新的
			if (gameState.usedWords.length > 0) {
				await db.insert(guessDrawUsedWords).values(
					gameState.usedWords.map((word) => ({
						roomId,
						word,
					}))
				);
			}
		}
	} catch (error) {
		console.error('Error updating game state:', error);
		throw error;
	}
}

// 添加玩家到房间
async function addPlayerToRoom(
	roomId: string,
	userId: string,
	username: string
): Promise<void> {
	try {
		// 检查玩家是否已存在
		const existing = await db
			.select()
			.from(guessDrawPlayers)
			.where(
				and(
					eq(guessDrawPlayers.roomId, roomId),
					eq(guessDrawPlayers.userId, userId)
				)
			)
			.limit(1);

		if (existing.length === 0) {
			await db.insert(guessDrawPlayers).values({
				roomId,
				userId,
				username,
				score: 0,
				hasGuessed: false,
				isDrawing: false,
			});
		}
	} catch (error) {
		console.error('Error adding player to room:', error);
		throw error;
	}
}

export { roomUsers };

export const gameRoute = new Elysia()
	.use(optionalAuth)
	.derive(() => ({ connectionId: crypto.randomUUID() }))
	.ws('/ws/guess-draw', {
		query: t.Object({
			roomId: t.String(),
			totalRounds: t.Optional(t.String()),
			roundTimeLimit: t.Optional(t.String()),
		}),
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
			roomConnections.get(roomId)!.add(ws as unknown as WebSocket);

			// 建立玩家-连接映射（用于识别每个连接对应的玩家）
			if (!playerConnectionMap.has(roomId)) {
				playerConnectionMap.set(roomId, new Map());
			}
			playerConnectionMap.get(roomId)!.set(userId, ws as unknown as WebSocket);

			// 添加用户到房间
			if (!roomUsers.has(roomId)) {
				roomUsers.set(roomId, new Set());
			}
			const room = roomUsers.get(roomId)!;
			room.add(userId); // 如果有清理定时器，取消它（因为房间又有人了）
			clearRoomCleanupTimer(roomId);

			// 发送连接确认给当前用户
			ws.send({
				type: 'connected',
				userId,
				username,
				roomId,
				timestamp: Date.now(),
			});

			// 获取或创建游戏状态
			let gameState = await getGameState(roomId);
			if (!gameState) {
				console.log(`创建新游戏状态: ${roomId}`);
				const roomUserIds = Array.from(room);

				// 从查询参数获取自定义设置
				const totalRounds = ws.data.query?.totalRounds
					? parseInt(ws.data.query.totalRounds)
					: 3;
				const roundTimeLimit = ws.data.query?.roundTimeLimit
					? parseInt(ws.data.query.roundTimeLimit)
					: 60;

				gameState = {
					mode: 'guess-draw',
					isActive: false,
					currentRound: 0,
					totalRounds,
					currentDrawer: null,
					currentWord: null,
					wordHint: null,
					roundStartTime: null,
					roundTimeLimit,
					players: roomUserIds.map((id: string) => ({
						userId: id,
						username: id === userId ? username : '',
						score: 0,
						hasGuessed: false,
						isDrawing: false,
					})),
					usedWords: [],
				};
				await updateGameState(roomId, gameState);
			}

			// 检查是否是新玩家
			const existingPlayer = gameState.players.find(
				(p: GamePlayer) => p.userId === userId
			);
			if (!existingPlayer) {
				console.log(`新玩家加入: ${username}(${userId})`);
				// 添加玩家到数据库
				await addPlayerToRoom(roomId, userId, username);
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
					const existingGameState = await getGameState(roomId);

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
							message: '至少需要 2 名玩家才能开始游戏',
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
						// 确保所有玩家都在数据库中
						for (const playerId of currentRoom) {
							const playerUsername = playerId === userId ? username : '';
							await addPlayerToRoom(roomId, playerId, playerUsername);
						}
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
						roundTimeLimit:
							message.roundTimeLimit || existingGameState?.roundTimeLimit || 60,
						players,
						usedWords: [],
					};

					await updateGameState(roomId, newGameState);

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
					ws.publish(roomId, initialStateMsg); // 延迟启动第一轮，确保所有客户端都收到状态
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

			const gameState = await getGameState(roomId);
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

							// 保存更新后的游戏状态到数据库
							await updateGameState(roomId, gameState);

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

							// 广播更新后的游戏状态（使用 broadcastGameState 确保 currentWord 只发送给画者）
							broadcastGameState(roomId, gameState); // 延迟3秒后开始下一轮
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

		async close(ws) {
			const { user } = ws.data;
			const userId = user.id.toString();
			const username = user.name;
			const { roomId } = ws.data.query;

			console.log(`用户 ${username}(${userId}) 离开房间 ${roomId}`);

			// 移除连接引用
			const connections = roomConnections.get(roomId);
			if (connections) {
				connections.delete(ws as unknown as WebSocket);
				if (connections.size === 0) {
					roomConnections.delete(roomId);
				}
			}

			// 清理玩家连接映射
			const playerConnections = playerConnectionMap.get(roomId);
			if (playerConnections) {
				playerConnections.delete(userId);
				if (playerConnections.size === 0) {
					playerConnectionMap.delete(roomId);
				}
			}
			const room = roomUsers.get(roomId);
			if (!room) return;

			room.delete(userId);

			const gameState = await getGameState(roomId);
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
			if (gameState && gameState.isActive && gameState.players.length === 1) {
				console.log('房间只剩一个人，宣布胜利者');
				const remainingPlayer = gameState.players[0];

				if (remainingPlayer) {
					// 给胜利者加分
					remainingPlayer.score += 500; // 胜利奖励分

					// 广播胜利消息
					const victoryMsg = {
						type: 'game-end',
						winner: remainingPlayer.userId,
						winnerName: remainingPlayer.username,
						reason: 'last-player-standing',
						finalScores: gameState.players.sort((a, b) => b.score - a.score),
						timestamp: Date.now(),
					};
					broadcastToAll(roomId, victoryMsg);

					// 清理游戏状态
					await updateGameState(roomId, { isActive: false });
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

			// 广播更新后的游戏状态（使用 broadcastGameState 隐藏非画者的 currentWord）
			if (gameState) {
				// 更新游戏状态以移除离开的玩家
				gameState.players = gameState.players.filter(
					(p: GamePlayer) => p.userId !== userId
				);
				broadcastGameState(roomId, gameState);
				console.log(
					`向房间 ${roomId} 广播更新的游戏状态（已移除玩家 ${userId}）`
				);
			}

			// 从数据库中删除该玩家的记录
			try {
				await db
					.delete(guessDrawPlayers)
					.where(
						and(
							eq(guessDrawPlayers.roomId, roomId),
							eq(guessDrawPlayers.userId, userId)
						)
					);
				console.log(`从数据库删除玩家 ${userId} 的记录`);
			} catch (error) {
				console.error('删除玩家记录失败:', error);
			}

			// 如果房间内的玩家空了，设置清理定时器（10分钟后清理）
			if (gameState?.players.length === 0) {
				console.log(
					`房间 ${roomId} 内已无玩家（数据库中玩家数: ${gameState.players.length}），设置10分钟清理定时器`
				);
				scheduleRoomCleanup(roomId);
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
			ws.send(JSON.stringify(message));
		} catch (error) {
			console.error('发送消息失败:', error);
		}
	});
}

// 根据玩家身份发送不同的游戏状态消息（隐藏非画者的 currentWord）
function broadcastGameState(
	roomId: string,
	gameState: GameState,
	additionalFields?: Record<string, unknown>
) {
	// 获取存储的玩家连接信息
	const playerConnections = playerConnectionMap.get(roomId);
	if (!playerConnections || playerConnections.size === 0) {
		console.log(`警告：房间 ${roomId} 没有活跃连接或玩家映射`);
		return;
	}

	// 遍历每个玩家的连接，发送特定于玩家的消息
	playerConnections.forEach((ws, userId) => {
		try {
			// 根据玩家身份构建消息
			const isDrawer = gameState.currentDrawer === userId;

			const stateMessage = {
				type: 'game-state',
				data: {
					...gameState,
					// 只有画者才能看到真实的单词，其他人只能看到提示
					currentWord: isDrawer ? gameState.currentWord : null,
				},
				...(additionalFields || {}),
				timestamp: Date.now(),
			};

			ws.send(JSON.stringify(stateMessage));
		} catch (error) {
			console.error(`向用户 ${userId} 发送游戏状态失败:`, error);
		}
	});
}

async function startNewRound(
	roomId: string,
	ws: {
		publish: (roomId: string, message: Record<string, unknown>) => void;
		data: { user?: { id?: number | string; name?: string } };
	}
) {
	const gameState = await getGameState(roomId);
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
		(wordEntry: WordEntry) => !gameState.usedWords.includes(wordEntry.word)
	);
	let newWordEntry: WordEntry | undefined;

	if (availableWords.length > 0) {
		const randomIndex = Math.floor(Math.random() * availableWords.length);
		newWordEntry = availableWords[randomIndex];
	} else {
		console.log('词库已用完，重置');
		gameState.usedWords = [];
		newWordEntry =
			WORD_LIBRARY[Math.floor(Math.random() * WORD_LIBRARY.length)];
	}

	const newWord = newWordEntry?.word || '';
	const wordCategory = newWordEntry?.category || '未知';

	gameState.usedWords.push(newWord);
	console.log(`选择词汇: ${newWord} (${wordCategory})`);

	// 生成提示（根据词长度智能隐藏）
	const generateHint = (word: string): string => {
		if (word.length === 0) return '';
		if (word.length === 1) return '_'; // 单字词完全隐藏
		if (word.length === 2) return word[0] + '_'; // 两字词只显示首字
		if (word.length === 3) return word[0] + '__'; // 三字词只显示首字
		if (word.length <= 5)
			return word[0] + '_'.repeat(word.length - 2) + word[word.length - 1]; // 4-5字词显示首尾
		// 6字以上：显示首字、末字，中间每隔一个显示一个
		const hint = word.split('').map((char, index) => {
			if (index === 0 || index === word.length - 1) return char;
			if (index % 2 === 1) return char;
			return '_';
		});
		return hint.join('');
	};

	const wordHint = generateHint(newWord);

	// 更新游戏状态
	gameState.currentDrawer = newDrawer.userId;
	gameState.currentWord = newWord || '';
	gameState.wordHint = wordHint;
	gameState.roundStartTime = Date.now();

	await updateGameState(roomId, {
		currentRound: gameState.currentRound,
		currentDrawer: gameState.currentDrawer,
		currentWord: gameState.currentWord,
		wordHint: gameState.wordHint,
		roundStartTime: gameState.roundStartTime,
		players: gameState.players, // 更新玩家状态，包括 hasGuessed 重置
	});

	console.log(`提示: ${wordHint}`);
	console.log(
		`回合开始时间: ${new Date(gameState.roundStartTime).toLocaleTimeString()}`
	);

	console.log('发送游戏状态给所有人');
	// 使用 broadcastGameState 替代 broadcastToAll，确保 currentWord 只发送给画者
	broadcastGameState(roomId, gameState, {
		type: 'game-state',
		isActive: true,
		roundTimeLimit: gameState.roundTimeLimit,
	});

	// 发送回合开始通知（用于UI提示和动画）
	const roundStartMsg = {
		type: 'round-start',
		currentRound: gameState.currentRound,
		totalRounds: gameState.totalRounds,
		currentDrawer: gameState.currentDrawer,
		drawerUsername: newDrawer.username,
		wordHint: gameState.wordHint,
		wordCategory: wordCategory,
		roundStartTime: gameState.roundStartTime,
		roundTimeLimit: gameState.roundTimeLimit,
		timestamp: Date.now(),
	};

	console.log('发送回合开始通知');
	broadcastToAll(roomId, roundStartMsg);

	// 设置回合定时器
	clearRoundTimer(roomId);
	const timer = setTimeout(async () => {
		console.log(`回合 ${gameState.currentRound} 时间到`);
		const currentGame = await getGameState(roomId);
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

async function endGame(
	roomId: string,
	ws: {
		publish: (roomId: string, message: Record<string, unknown>) => void;
		data: { user?: { id?: number | string; name?: string } };
	}
) {
	console.log(`\n========== 游戏结束: ${roomId}  ==========`);

	console.log('WebSocket:', ws.data);
	const gameState = await getGameState(roomId);
	if (!gameState) return;

	// 清除定时器
	clearRoundTimer(roomId);

	// 标记游戏结束
	gameState.isActive = false;

	await updateGameState(roomId, { isActive: false });

	// 按分数排序
	const finalScores = gameState.players.sort(
		(a: GamePlayer, b: GamePlayer) => b.score - a.score
	);

	console.log('最终排名:');
	finalScores.forEach((p: GamePlayer, i: number) => {
		console.log(`  ${i + 1}. ${p.username}: ${p.score}分`);
	});

	const endMsg = {
		type: 'game-end',
		finalScores,
		timestamp: Date.now(),
	};
	broadcastToAll(roomId, endMsg);

	// 广播最终游戏状态（使用 broadcastGameState 隐藏非画者的 currentWord）
	broadcastGameState(roomId, gameState);

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

// 清理房间定时器
function clearRoomCleanupTimer(roomId: string) {
	const timer = roomCleanupTimers.get(roomId);
	if (timer) {
		clearTimeout(timer);
		roomCleanupTimers.delete(roomId);
		console.log(`清除房间 ${roomId} 的清理定时器`);
	}
}

// 设置房间清理定时器（10分钟后清理空房间）
function scheduleRoomCleanup(roomId: string) {
	// 先清除现有的清理定时器
	clearRoomCleanupTimer(roomId);

	// 设置10分钟后的清理定时器
	const timer = setTimeout(
		async () => {
			console.log(`房间 ${roomId} 清理定时器触发，检查是否需要清理`);

			// 再次检查房间是否为空（基于数据库中的玩家数量）
			const gameState = await getGameState(roomId);
			if (!gameState || gameState.players.length === 0) {
				console.log(`房间 ${roomId} 已空置10分钟，开始清理`);

				// 从内存中删除房间
				roomUsers.delete(roomId);
				clearRoundTimer(roomId);

				// 从数据库删除房间及相关数据
				try {
					await db
						.delete(guessDrawPlayers)
						.where(eq(guessDrawPlayers.roomId, roomId));
					await db
						.delete(guessDrawUsedWords)
						.where(eq(guessDrawUsedWords.roomId, roomId));
					await db.delete(guessDrawRooms).where(eq(guessDrawRooms.id, roomId));
					console.log(`房间 ${roomId} 已从数据库删除`);
				} catch (error) {
					console.error(`删除房间 ${roomId} 失败:`, error);
				}
			} else {
				console.log(
					`房间 ${roomId} 仍有 ${gameState.players.length} 个玩家，取消清理`
				);
			}

			// 清理定时器引用
			roomCleanupTimers.delete(roomId);
		},
		1 * 60 * 1000
	); // 10分钟

	roomCleanupTimers.set(roomId, timer);
	console.log(`设置房间 ${roomId} 的清理定时器（10分钟后清理）`);
}
