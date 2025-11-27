import { Elysia, t } from 'elysia';
import { auth } from '../utils/verify';
import { WORD_LIBRARY, type GameState } from '../types';

// 内存中存储游戏状态（生产环境应使用数据库）
export const gameRooms = new Map<string, GameState>();

// 生成房间ID
function generateRoomId(): string {
	return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// 创建新游戏房间
export const guessDrawRoutes = new Elysia({ prefix: '/guess-draw' })
	.use(auth)
	// 获取词库
	.get('/words', () => {
		return {
			success: true,
			data: {
				words: WORD_LIBRARY,
				count: WORD_LIBRARY.length,
			},
		};
	})

	// 获取房间列表
	.get('/rooms', () => {
		const rooms = Array.from(gameRooms.entries()).map(([id, gameState]) => ({
			id,
			name: id,
			ownerId: gameState.players[0]?.userId || '',
			ownerName: gameState.players[0]?.username || '未知',
			maxPlayers: 8,
			currentPlayers: gameState.players.length,
			rounds: gameState.totalRounds,
			roundTime: gameState.roundTimeLimit,
			isPrivate: false,
			status: (gameState.isActive ? 'playing' : 'waiting') as
				| 'waiting'
				| 'playing'
				| 'finished',
			createdAt: new Date().toISOString(),
		}));

		return {
			success: true,
			data: {
				rooms,
				count: rooms.length,
			},
		};
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

			const roomId = generateRoomId();
			const totalRounds = body.totalRounds || 3;
			const roundTimeLimit = body.roundTimeLimit || 60;

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
						userId: user.id.toString(),
						username: user.name,
						score: 0,
						hasGuessed: false,
						isDrawing: false,
					},
				],
				usedWords: [],
			};

			gameRooms.set(roomId, gameState);

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
			}),
		}
	)

	// 加入游戏房间
	.post('/:roomId/join', async ({ params, set, user }) => {
		if (!user) {
			set.status = 401;
			return {
				success: false,
				message: '未授权访问',
			};
		}

		const { roomId } = params;
		const gameState = gameRooms.get(roomId);

		if (!gameState) {
			set.status = 404;
			return {
				success: false,
				message: '房间不存在',
			};
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
	})

	// 获取房间游戏状态
	.get('/:roomId', async ({ params, set }) => {
		const { roomId } = params;
		const gameState = gameRooms.get(roomId);

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
		const gameState = gameRooms.get(roomId);

		if (!gameState) {
			set.status = 404;
			return {
				success: false,
				message: '房间不存在',
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
			(word) => !gameState.usedWords.includes(word)
		);
		const randomWord =
			availableWords[Math.floor(Math.random() * availableWords.length)] ||
			WORD_LIBRARY[0];
		if (!randomWord) {
			return {
				success: false,
				message: '无法选择词语，请重试',
			};
		}
		gameState.currentWord = randomWord;
		gameState.usedWords.push(randomWord);

		// 生成提示（隐藏部分字符）
		const hintChars = randomWord
			.split('')
			.map((char, index) => (index % 2 === 0 ? char : '_'));
		gameState.wordHint = hintChars.join('');
		gameState.roundStartTime = Date.now();

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
			const gameState = gameRooms.get(roomId);

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
			const player = gameState.players.find((p) => p.userId === userId);

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

				// 检查是否所有玩家都猜对了
				const allGuessed = gameState.players
					.filter((p) => !p.isDrawing)
					.every((p) => p.hasGuessed);

				if (allGuessed) {
					// 所有玩家都猜对了，准备下一轮
					gameState.currentRound++;
					if (gameState.currentRound > gameState.totalRounds) {
						// 游戏结束
						gameState.isActive = false;
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
						const drawerIndex = gameState.players.findIndex((p) => p.isDrawing);
						if (drawerIndex === -1) {
							return {
								success: false,
								message: '找不到当前画者，请重试',
							};
						}
						const nextDrawerIndex =
							(drawerIndex + 1) % gameState.players.length;

						// 重置玩家状态
						gameState.players.forEach((p) => {
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
							(word) => !gameState.usedWords.includes(word)
						);
						const newWord =
							availableWords[
								Math.floor(Math.random() * availableWords.length)
							] || WORD_LIBRARY[0];
						if (!newWord) {
							return {
								success: false,
								message: '无法选择新词语，请重试',
							};
						}
						gameState.currentWord = newWord;
						gameState.usedWords.push(newWord);

						// 生成提示
						const hintChars = newWord
							.split('')
							.map((char, index) => (index % 2 === 0 ? char : '_'));
						gameState.wordHint = hintChars.join('');
						gameState.roundStartTime = Date.now();

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
		const gameState = gameRooms.get(roomId);

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
			const gameState = gameRooms.get(roomId);

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
		const gameState = gameRooms.get(roomId);

		if (!gameState) {
			set.status = 404;
			return {
				success: false,
				message: '房间不存在',
			};
		}

		gameState.isActive = false;

		// 按分数排序
		const sortedPlayers = [...gameState.players].sort(
			(a, b) => b.score - a.score
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
