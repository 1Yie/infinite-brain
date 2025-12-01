import { Elysia, t } from 'elysia';
import { auth } from '../utils/verify';
import { WORD_LIBRARY, type GameState, type GamePlayer } from '../types';
import { db } from '../db';
import {
	guessDrawRooms,
	guessDrawPlayers,
	guessDrawUsedWords,
} from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';

// 生成房间ID
async function generateRoomId(): Promise<string> {
	let roomId = '';
	let isUnique = false;

	while (!isUnique) {
		roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
		const existingRoom = await db
			.select()
			.from(guessDrawRooms)
			.where(eq(guessDrawRooms.id, roomId))
			.limit(1);
		isUnique = existingRoom.length === 0;
	}

	return roomId;
}

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

// 创建游戏房间
async function createGameRoom(
	roomId: string,
	ownerId: string,
	ownerName: string,
	totalRounds: number = 3,
	roundTimeLimit: number = 60,
	roomName?: string,
	isPrivate: boolean = false,
	password?: string
): Promise<GameState> {
	try {
		await db.insert(guessDrawRooms).values({
			id: roomId,
			name: roomName || roomId, // 使用自定义房间名称，如果没有则使用roomId
			ownerId,
			ownerName,
			totalRounds,
			roundTimeLimit,
			isPrivate,
			password: isPrivate ? password : undefined,
			status: 'waiting',
			currentRound: 0,
			currentPlayers: 1,
		});

		// 添加房主为第一个玩家
		await db.insert(guessDrawPlayers).values({
			roomId,
			userId: ownerId,
			username: ownerName,
			score: 0,
			hasGuessed: false,
			isDrawing: false,
		});

		const gameState: GameState = {
			mode: 'guess-draw',
			isActive: false,
			currentRound: 0,
			totalRounds,
			currentDrawer: null,
			currentWord: null,
			wordHint: null,
			roundStartTime: null,
			roundTimeLimit,
			players: [
				{
					userId: ownerId,
					username: ownerName,
					score: 0,
					hasGuessed: false,
					isDrawing: false,
				},
			],
			usedWords: [],
		};

		return gameState;
	} catch (error) {
		console.error('Error creating game room:', error);
		throw error;
	}
}

// 更新游戏状态
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

// 创建新游戏房间
export const guessDrawRoutes = new Elysia({ prefix: '/guess-draw' })
	.use(auth)
	// 获取词库
	.get('/words', () => {
		const words = WORD_LIBRARY.map((entry) => entry.word);
		return {
			success: true,
			data: {
				words,
				count: words.length,
			},
		};
	})

	// 获取房间列表
	.get('/rooms', async () => {
		try {
			// 从数据库获取所有房间
			const dbRooms = await db
				.select()
				.from(guessDrawRooms)
				.orderBy(desc(guessDrawRooms.createdAt));

			const rooms = await Promise.all(
				dbRooms.map(async (dbRoom) => {
					// 从数据库获取该房间的玩家数量
					const players = await db
						.select()
						.from(guessDrawPlayers)
						.where(eq(guessDrawPlayers.roomId, dbRoom.id));

					const currentPlayers = players.length;

					// 安全处理日期
					let createdAt: string;
					try {
						if (
							dbRoom.createdAt instanceof Date &&
							!isNaN(dbRoom.createdAt.getTime())
						) {
							createdAt = dbRoom.createdAt.toISOString();
						} else if (typeof dbRoom.createdAt === 'string') {
							const date = new Date(dbRoom.createdAt);
							if (!isNaN(date.getTime())) {
								createdAt = date.toISOString();
							} else {
								createdAt = new Date().toISOString();
							}
						} else {
							createdAt = new Date().toISOString();
						}
					} catch (error) {
						console.error(
							`处理房间 ${dbRoom.id} 的 createdAt 失败:`,
							dbRoom.createdAt,
							error
						);
						createdAt = new Date().toISOString();
					}

					const roomData = {
						id: dbRoom.id,
						name: dbRoom.name || dbRoom.id,
						ownerId: dbRoom.ownerId,
						ownerName: dbRoom.ownerName,
						maxPlayers: dbRoom.maxPlayers || 8,
						currentPlayers,
						rounds: dbRoom.totalRounds || 3,
						roundTime: dbRoom.roundTimeLimit || 60,
						isPrivate: Boolean(dbRoom.isPrivate),
						status: (dbRoom.status === 'playing' ? 'playing' : 'waiting') as
							| 'waiting'
							| 'playing'
							| 'finished',
						createdAt,
					};
					return roomData;
				})
			);

			// 显示所有房间，包括玩家数量为0的房间
			const validRooms = rooms.filter(
				(room): room is NonNullable<typeof room> => room !== null
			);

			validRooms.forEach((room) => {
				console.log(`房间 ${room.id} 数据:`, room);
			});

			return {
				success: true,
				data: {
					rooms: validRooms,
					count: validRooms.length,
				},
			};
		} catch (error) {
			console.error('获取房间列表失败:', error);
			return {
				success: false,
				message: '获取房间列表失败',
				data: {
					rooms: [],
					count: 0,
				},
			};
		}
	})

	// 创建新游戏房间
	.post(
		'/rooms',
		async ({ body, set, user }) => {
			if (!user) {
				set.status = 401;
				return {
					success: false,
					message: '未授权访问',
				};
			}

			const roomId = await generateRoomId();
			const totalRounds = body.totalRounds || 3;
			const roundTimeLimit = body.roundTimeLimit || 60;
			const roomName = body.roomName;
			const isPrivate = body.isPrivate || false;
			const password = body.password;

			const gameState = await createGameRoom(
				roomId,
				user.id.toString(),
				user.name,
				totalRounds,
				roundTimeLimit,
				roomName,
				isPrivate,
				password
			);

			return {
				success: true,
				data: {
					roomId,
					gameState,
				},
			};
		},
		{
			body: t.Object({
				totalRounds: t.Optional(t.Number()),
				roundTimeLimit: t.Optional(t.Number()),
				roomName: t.Optional(t.String()),
				isPrivate: t.Optional(t.Boolean()),
				password: t.Optional(t.String()),
			}),
		}
	)

	// 加入游戏房间
	.post(
		'/:roomId/join',
		async ({ params, body, set, user }) => {
			if (!user) {
				set.status = 401;
				return {
					success: false,
					message: '未授权访问',
				};
			}

			const { roomId } = params;
			const password = body.password;

			// 检查房间是否存在以及是否需要密码
			const room = await db
				.select()
				.from(guessDrawRooms)
				.where(eq(guessDrawRooms.id, roomId))
				.limit(1);

			if (room.length === 0) {
				set.status = 404;
				return {
					success: false,
					message: '房间不存在',
				};
			}

			const dbRoom = room[0]!;

			// 检查密码
			if (dbRoom.isPrivate) {
				if (!password || password !== dbRoom.password) {
					set.status = 403;
					return {
						success: false,
						message: '密码错误',
					};
				}
			}

			const gameState = await getGameState(roomId);

			if (!gameState) {
				set.status = 404;
				return {
					success: false,
					message: '房间不存在',
				};
			}

			// 如果房间没人，第一个加入的玩家成为房主
			if (gameState.players.length === 0) {
				await db
					.update(guessDrawRooms)
					.set({
						ownerId: user.id.toString(),
						ownerName: user.name,
					})
					.where(eq(guessDrawRooms.id, roomId));
				dbRoom.ownerId = user.id.toString();
				dbRoom.ownerName = user.name;
			}

			// 检查玩家是否已在房间中
			const existingPlayer = gameState.players.find(
				(p) => p.userId === user.id.toString()
			);

			if (existingPlayer) {
				return {
					success: true,
					message: '已成功加入房间',
					data: {
						roomId,
						gameState,
					},
				};
			}

			// 添加新玩家
			await addPlayerToRoom(roomId, user.id.toString(), user.name);
			gameState.players.push({
				userId: user.id.toString(),
				username: user.name,
				score: 0,
				hasGuessed: false,
				isDrawing: false,
			});

			return {
				success: true,
				message: '已成功加入房间',
				data: {
					roomId,
					gameState,
				},
			};
		},
		{
			body: t.Object({
				password: t.Optional(t.String()),
			}),
		}
	)

	// 获取房间游戏状态
	.get('/:roomId', async ({ params, set }) => {
		const { roomId } = params;
		const gameState = await getGameState(roomId);

		if (!gameState) {
			set.status = 404;
			return {
				success: false,
				message: '房间不存在',
			};
		}

		return {
			success: true,
			data: {
				roomId,
				gameState,
			},
		};
	})

	// 开始游戏
	.post('/:roomId/start', async ({ params, set, user }) => {
		if (!user) {
			set.status = 401;
			return {
				success: false,
				message: '未授权访问',
			};
		}

		const { roomId } = params;
		const gameState = await getGameState(roomId);

		if (!gameState) {
			set.status = 404;
			return {
				success: false,
				message: '房间不存在',
			};
		}

		// 获取房间信息以检查房主
		const room = await db
			.select()
			.from(guessDrawRooms)
			.where(eq(guessDrawRooms.id, roomId))
			.limit(1);

		if (room.length === 0 || room[0]!.ownerId !== user.id.toString()) {
			set.status = 403;
			return {
				success: false,
				message: '只有房主才能开始游戏',
			};
		}

		// 检查是否有足够玩家
		if (gameState.players.length < 2) {
			return {
				success: false,
				message: '需要至少2名玩家才能开始游戏',
			};
		}

		// 重置游戏状态
		gameState.isActive = true;
		gameState.currentRound = 1;
		gameState.usedWords = [];

		// 随机选择第一个画者
		const randomIndex = Math.floor(Math.random() * gameState.players.length);
		const firstDrawer = gameState.players[randomIndex];
		if (!firstDrawer) {
			return {
				success: false,
				message: '无法选择画者，请重试',
			};
		}
		gameState.currentDrawer = firstDrawer.userId;
		firstDrawer.isDrawing = true;

		// 随机选择一个词
		const availableWords = WORD_LIBRARY.filter(
			(wordEntry) => !gameState.usedWords.includes(wordEntry.word)
		);
		const randomWordEntry =
			availableWords[Math.floor(Math.random() * availableWords.length)] ||
			WORD_LIBRARY[0];
		if (!randomWordEntry) {
			return {
				success: false,
				message: '无法选择词语，请重试',
			};
		}
		const randomWord = randomWordEntry.word;
		gameState.currentWord = randomWord;
		gameState.usedWords.push(randomWord);

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

		gameState.wordHint = generateHint(randomWord);
		gameState.roundStartTime = Date.now();

		// 更新数据库
		await updateGameState(roomId, gameState);

		return {
			success: true,
			message: '游戏已开始',
			data: {
				roomId,
				gameState,
			},
		};
	})

	// 提交猜测
	.post(
		'/:roomId/guess',
		async ({ params, body, set, user }) => {
			if (!user) {
				set.status = 401;
				return {
					success: false,
					message: '未授权访问',
				};
			}

			const { roomId } = params;
			const { guess } = body;
			const gameState = await getGameState(roomId);

			if (!gameState) {
				set.status = 404;
				return {
					success: false,
					message: '房间不存在',
				};
			}

			if (!gameState.isActive || !gameState.currentWord) {
				return {
					success: false,
					message: '游戏未进行中或当前没有可猜测的词',
				};
			}

			const userId = user.id.toString();
			const player = gameState.players.find(
				(p: GamePlayer) => p.userId === userId
			);

			if (!player) {
				return {
					success: false,
					message: '您不在游戏中',
				};
			}

			if (player.isDrawing) {
				return {
					success: false,
					message: '画者不能猜词',
				};
			}

			if (player.hasGuessed) {
				return {
					success: false,
					message: '您已经猜过了',
				};
			}

			const isCorrect =
				guess.trim().toLowerCase() === gameState.currentWord.toLowerCase();

			if (isCorrect) {
				player.hasGuessed = true;
				// 计算得分（基于剩余时间）
				const elapsed = (Date.now() - (gameState.roundStartTime || 0)) / 1000;
				const timeBonus = Math.max(0, gameState.roundTimeLimit - elapsed);
				player.score += Math.floor(100 + timeBonus * 2);

				// 保存更新后的游戏状态到数据库
				await updateGameState(roomId, gameState);

				// 检查是否所有玩家都猜对了
				const allGuessed = gameState.players
					.filter((p: GamePlayer) => !p.isDrawing)
					.every((p: GamePlayer) => p.hasGuessed);

				if (allGuessed) {
					// 所有玩家都猜对了，准备下一轮
					gameState.currentRound++;
					if (gameState.currentRound > gameState.totalRounds) {
						// 游戏结束
						gameState.isActive = false;
						await updateGameState(roomId, gameState);
						return {
							success: true,
							message: '游戏结束',
							data: {
								roomId,
								gameState,
								gameOver: true,
							},
						};
					} else {
						// 准备下一轮
						// 选择下一个画者
						const drawerIndex = gameState.players.findIndex(
							(p: GamePlayer) => p.isDrawing
						);
						if (drawerIndex === -1) {
							return {
								success: false,
								message: '找不到当前画者，请重试',
							};
						}
						const nextDrawerIndex =
							(drawerIndex + 1) % gameState.players.length;

						// 重置玩家状态
						gameState.players.forEach((p: GamePlayer) => {
							p.hasGuessed = false;
							p.isDrawing = false;
						});

						const nextDrawer = gameState.players[nextDrawerIndex];
						if (!nextDrawer) {
							return {
								success: false,
								message: '无法选择下一个画者，请重试',
							};
						}
						nextDrawer.isDrawing = true;
						gameState.currentDrawer = nextDrawer.userId;

						// 选择新词
						const availableWords = WORD_LIBRARY.filter(
							(wordEntry) => !gameState.usedWords.includes(wordEntry.word)
						);
						const newWordEntry =
							availableWords[
								Math.floor(Math.random() * availableWords.length)
							] || WORD_LIBRARY[0];
						if (!newWordEntry) {
							return {
								success: false,
								message: '无法选择新词语，请重试',
							};
						}
						const newWord = newWordEntry.word;
						gameState.currentWord = newWord;
						gameState.usedWords.push(newWord);

						// 生成提示（根据词长度智能隐藏）
						const generateHint2 = (word: string): string => {
							if (word.length === 0) return '';
							if (word.length === 1) return '_';
							if (word.length === 2) return word[0] + '_';
							if (word.length === 3) return word[0] + '__';
							if (word.length <= 5)
								return (
									word[0] + '_'.repeat(word.length - 2) + word[word.length - 1]
								);
							const hint = word.split('').map((char, index) => {
								if (index === 0 || index === word.length - 1) return char;
								if (index % 2 === 1) return char;
								return '_';
							});
							return hint.join('');
						};

						gameState.wordHint = generateHint2(newWord);
						gameState.roundStartTime = Date.now();

						// 保存下一轮的游戏状态
						await updateGameState(roomId, gameState);
						return {
							success: true,
							message: '恭喜猜对！准备下一轮',
							data: {
								roomId,
								gameState,
								correct: true,
								nextRound: true,
							},
						};
					}
				}

				return {
					success: true,
					message: '恭喜猜对！',
					data: {
						roomId,
						gameState,
						correct: true,
					},
				};
			} else {
				return {
					success: true,
					message: '猜错了，请再试一次',
					data: {
						roomId,
						gameState,
						correct: false,
					},
				};
			}
		},
		{
			body: t.Object({
				guess: t.String(),
			}),
		}
	)

	// 获取当前词（仅画者可见）
	.get('/:roomId/word', async ({ params, set, user }) => {
		if (!user) {
			set.status = 401;
			return {
				success: false,
				message: '未授权访问',
			};
		}

		const { roomId } = params;
		const gameState = await getGameState(roomId);

		if (!gameState) {
			set.status = 404;
			return {
				success: false,
				message: '房间不存在',
			};
		}

		const userId = user.id.toString();
		const isDrawer = gameState.currentDrawer === userId;

		return {
			success: true,
			data: {
				roomId,
				word: isDrawer ? gameState.currentWord : null,
				hint: gameState.wordHint,
				isDrawer,
			},
		};
	})

	// 提交绘画数据
	.post(
		'/:roomId/draw',
		async ({ params, set, user }) => {
			if (!user) {
				set.status = 401;
				return {
					success: false,
					message: '未授权访问',
				};
			}

			const { roomId } = params;
			// const { stroke } = body;
			const gameState = await getGameState(roomId);

			if (!gameState) {
				set.status = 404;
				return {
					success: false,
					message: '房间不存在',
				};
			}

			const userId = user.id.toString();

			// 只有画者才能提交绘画数据
			if (gameState.currentDrawer !== userId) {
				set.status = 403;
				return {
					success: false,
					message: '只有画者才能绘画',
				};
			}

			// 这里可以添加将绘画数据保存到数据库或广播给其他玩家的逻辑
			// 目前只是简单返回成功

			return {
				success: true,
				message: '绘画数据已提交',
			};
		},
		{
			body: t.Object({
				stroke: t.Any(),
			}),
		}
	)

	// 结束游戏
	.post('/:roomId/end', async ({ params, set, user }) => {
		if (!user) {
			set.status = 401;
			return {
				success: false,
				message: '未授权访问',
			};
		}

		const { roomId } = params;
		const gameState = await getGameState(roomId);

		if (!gameState) {
			set.status = 404;
			return {
				success: false,
				message: '房间不存在',
			};
		}

		gameState.isActive = false;

		// 更新数据库
		await updateGameState(roomId, gameState);

		// 按分数排序
		const sortedPlayers = [...gameState.players].sort(
			(a: GamePlayer, b: GamePlayer) => b.score - a.score
		);
		const winner = sortedPlayers.length > 0 ? sortedPlayers[0] : null;

		return {
			success: true,
			message: '游戏已结束',
			data: {
				roomId,
				gameState,
				finalScores: sortedPlayers,
				winner,
			},
		};
	});
