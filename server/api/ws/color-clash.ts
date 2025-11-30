import { Elysia, t } from 'elysia';
import { optionalAuth } from '../../utils/verify';
import { db } from '../../db';
import { colorClashRooms, colorClashPlayers } from '../../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';

type ColorClashRoom = InferSelectModel<typeof colorClashRooms>;
type ColorClashClientMessage =
	| { type: 'join-room'; roomId: string }
	| { type: 'leave-room' }
	| {
			type: 'draw';
			data: { x: number; y: number; color: string; size: number };
	  }
	| { type: 'game-start' }
	| { type: 'game-chat'; message: string; id?: string }
	| { type: 'ping' };

// 类型守卫函数，确保 ColorClashClientMessage 类型被使用
function isColorClashClientMessage(
	message: unknown
): message is ColorClashClientMessage {
	const msg = message as Record<string, unknown>;
	return (
		msg !== null &&
		typeof msg === 'object' &&
		'type' in msg &&
		typeof msg.type === 'string' &&
		[
			'join-room',
			'leave-room',
			'draw',
			'game-start',
			'game-chat',
			'ping',
		].includes(msg.type)
	);
}

type ColorClashServerMessage =
	| { type: 'room-joined'; room: ColorClashRoom; players: ColorClashPlayer[] }
	| { type: 'player-joined'; player: ColorClashPlayer }
	| { type: 'player-left'; userId: string }
	| { type: 'game-started'; gameState: ColorClashGameState }
	| { type: 'draw-update'; data: unknown; userId: string }
	| {
			type: 'game-ended';
			winner: string | null;
			finalScores: ColorClashPlayer[];
	  }
	| { type: 'score-update'; scores: { userId: string; score: number }[] }
	| {
			type: 'game-chat';
			message: string;
			username: string;
			timestamp: number;
			id?: string;
	  }
	| { type: 'error'; message: string }
	| { type: 'pong' }
	| {
			type: 'connected';
			userId: string;
			username: string;
			roomId: string;
			timestamp: number;
	  }
	| { type: 'owner-changed'; newOwnerId: string; newOwnerName: string };

interface ColorClashGameState {
	mode: 'color-clash';
	isActive: boolean;
	gameStartTime: number | null;
	gameTimeLimit: number;
	players: ColorClashPlayer[];
	canvasWidth: number;
	canvasHeight: number;
	colorData: Uint8ClampedArray | null;
	winner: string | null;
	gameEndTime: number | null;
	room: {
		id: string;
		name: string;
		ownerId: string;
		ownerName: string;
		maxPlayers: number;
		gameTime: number;
		canvasWidth: number;
		canvasHeight: number;
		isPrivate: boolean;
		status: string;
		createdAt: Date;
	};
}

interface ColorClashPlayer {
	userId: string;
	username: string;
	color: string;
	score: number;
	isConnected: boolean;
	lastActivity: number;
	x?: number; // 玩家在画布上的X坐标
	y?: number; // 玩家在画布上的Y坐标
}

function processDateField(
	dateValue: Date | number | string | null | undefined
): string | null {
	if (!dateValue) return null;
	try {
		if (typeof dateValue === 'number') {
			const date = new Date(dateValue);
			return isNaN(date.getTime()) ? null : date.toISOString();
		} else if (dateValue instanceof Date) {
			return isNaN(dateValue.getTime()) ? null : dateValue.toISOString();
		} else if (typeof dateValue === 'string') {
			const parsedDate = new Date(dateValue);
			return isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString();
		}
		return null;
	} catch (error) {
		console.error('Error processing date field:', error);
		return null;
	}
}

function processRoomDateFields(
	roomData: Partial<ColorClashRoom>
): ColorClashRoom {
	const processedData = { ...roomData } as ColorClashRoom;
	if (roomData.createdAt) {
		const processedDate = processDateField(roomData.createdAt);
		processedData.createdAt = processedDate
			? new Date(processedDate)
			: new Date();
	} else {
		processedData.createdAt = new Date();
	}
	processedData.gameStartTime = processDateField(roomData.gameStartTime)
		? new Date(processDateField(roomData.gameStartTime)!)
		: null;
	processedData.gameEndTime = processDateField(roomData.gameEndTime)
		? new Date(processDateField(roomData.gameEndTime)!)
		: null;
	return processedData;
}

// 房间连接管理
const roomConnections = new Map<string, Set<WebSocket>>();
// 游戏结束定时器
const gameTimers = new Map<string, NodeJS.Timer>();
// 数据库同步定时器 (新增，用于防止高频写入锁库)
const syncTimers = new Map<string, NodeJS.Timer>();
// 房间清理定时器
const roomCleanupTimers = new Map<string, NodeJS.Timer>();

// 房间用户管理
const roomUsers = new Map<string, Set<string>>();
// 用户连接管理
const userConnections = new Map<string, WebSocket>();
// 游戏状态缓存
const gameStates = new Map<string, ColorClashGameState>();

function broadcastToAll(roomId: string, message: ColorClashServerMessage) {
	const connections = roomConnections.get(roomId);
	if (!connections || connections.size === 0) return;

	connections.forEach((ws) => {
		try {
			ws.send(JSON.stringify(message));
		} catch (error) {
			console.error('发送消息失败:', error);
		}
	});
}

function broadcastToRoomExcept(
	roomId: string,
	message: ColorClashServerMessage,
	exceptWs: WebSocket
) {
	const connections = roomConnections.get(roomId);
	if (!connections || connections.size === 0) return;

	connections.forEach((ws) => {
		if (ws !== exceptWs) {
			try {
				ws.send(JSON.stringify(message));
			} catch (error) {
				console.error('发送消息失败:', error);
			}
		}
	});
}

async function getGameState(
	roomId: string
): Promise<ColorClashGameState | null> {
	try {
		const room = await db
			.select()
			.from(colorClashRooms)
			.where(eq(colorClashRooms.id, roomId))
			.limit(1);

		if (room.length === 0) return null;

		const dbRoom = room[0]!;
		const players = await db
			.select()
			.from(colorClashPlayers)
			.where(eq(colorClashPlayers.roomId, roomId));

		const safeGetTime = (date: Date | null | undefined): number | null => {
			if (!date) return null;
			try {
				const time = date.getTime();
				return isNaN(time) ? null : time;
			} catch {
				return null;
			}
		};

		const gameState: ColorClashGameState = {
			mode: 'color-clash',
			isActive: dbRoom.status === 'playing',
			gameStartTime: safeGetTime(dbRoom.gameStartTime),
			gameTimeLimit: dbRoom.gameTime,
			players: players.map((p) => ({
				userId: p.userId,
				username: p.username,
				color: p.color,
				score: p.score,
				isConnected: p.isConnected ?? false,
				lastActivity: safeGetTime(p.lastActivity) || Date.now(),
			})),
			canvasWidth: dbRoom.canvasWidth,
			canvasHeight: dbRoom.canvasHeight,
			colorData: null,
			winner: dbRoom.winnerId || null,
			gameEndTime: safeGetTime(dbRoom.gameEndTime),
			room: {
				id: dbRoom.id,
				name: dbRoom.name,
				ownerId: dbRoom.ownerId,
				ownerName: dbRoom.ownerName,
				maxPlayers: dbRoom.maxPlayers,
				gameTime: dbRoom.gameTime,
				canvasWidth: dbRoom.canvasWidth,
				canvasHeight: dbRoom.canvasHeight,
				isPrivate: dbRoom.isPrivate ?? false,
				status: dbRoom.status,
				createdAt: dbRoom.createdAt || new Date(),
			},
		};

		return gameState;
	} catch (error) {
		console.error('获取颜色对抗游戏状态失败:', error);
		return null;
	}
}

async function saveGameState(roomId: string, gameState: ColorClashGameState) {
	// 简单的锁检查或错误处理，防止写入冲突崩溃
	try {
		// 更新房间状态
		await db
			.update(colorClashRooms)
			.set({
				status: gameState.isActive
					? 'playing'
					: gameState.winner
						? 'finished'
						: 'waiting',
				gameStartTime: gameState.gameStartTime
					? new Date(gameState.gameStartTime)
					: null,
				gameEndTime: gameState.gameEndTime
					? new Date(gameState.gameEndTime)
					: null,
				winnerId: gameState.winner,
				ownerId: gameState.room.ownerId,
				ownerName: gameState.room.ownerName,
			})
			.where(eq(colorClashRooms.id, roomId));

		// 更新玩家分数
		// 优化：可以使用 Promise.all 并行更新，或者批量更新（如果ORM支持）
		// 这里为了简单，依然保留循环，但由 syncTimer 调用频率较低
		for (const player of gameState.players) {
			await db
				.update(colorClashPlayers)
				.set({
					score: player.score,
					isConnected: player.isConnected,
					lastActivity: new Date(player.lastActivity),
				})
				.where(
					and(
						eq(colorClashPlayers.roomId, roomId),
						eq(colorClashPlayers.userId, player.userId)
					)
				);
		}
	} catch (error) {
		console.error('保存颜色对抗游戏状态失败 (Database Locked?):', error);
	}
}

// 开始游戏
async function startGame(roomId: string) {
	let gameState: ColorClashGameState | undefined = gameStates.get(roomId);
	if (!gameState) {
		const fetchedState = await getGameState(roomId);
		if (!fetchedState) return;
		gameState = fetchedState;
	}

	gameState.isActive = true;
	gameState.gameStartTime = Date.now();
	gameState.gameEndTime = null;
	gameState.winner = null;
	gameState.colorData = null;

	gameState.players.forEach((player) => {
		player.score = 0;
		player.isConnected = true;
		player.lastActivity = Date.now();
		player.x = Math.floor(gameState!.canvasWidth / 2);
		player.y = Math.floor(gameState!.canvasHeight / 2);
	});

	gameStates.set(roomId, gameState);
	await saveGameState(roomId, gameState);

	// 开启定期同步定时器 (每5秒保存一次数据库，避免 Database Locked)
	if (syncTimers.has(roomId)) clearInterval(syncTimers.get(roomId));
	const syncInterval = setInterval(() => {
		const currentState = gameStates.get(roomId);
		if (currentState) {
			saveGameState(roomId, currentState);
		}
	}, 5000);
	syncTimers.set(roomId, syncInterval);

	broadcastToAll(roomId, {
		type: 'game-started',
		gameState,
	});

	const timer = setTimeout(async () => {
		await endGame(roomId);
	}, gameState.gameTimeLimit * 1000);

	gameTimers.set(roomId, timer);
	console.log(`房间 ${roomId} 游戏开始，Sync定时器已启动`);
}

// 结束游戏
async function endGame(roomId: string) {
	let gameState: ColorClashGameState | undefined = gameStates.get(roomId);
	if (!gameState) {
		const fetchedState = await getGameState(roomId);
		if (!fetchedState) return;
		gameState = fetchedState;
	}

	gameState.isActive = false;
	gameState.gameEndTime = Date.now();

	let winner = null;
	let maxScore = 0;
	for (const player of gameState.players) {
		if (player.score > maxScore) {
			maxScore = player.score;
			winner = player;
		}
	}
	gameState.winner = winner?.userId || null;

	gameStates.set(roomId, gameState);

	// 清除同步定时器并执行最后一次保存
	if (syncTimers.has(roomId)) {
		clearInterval(syncTimers.get(roomId));
		syncTimers.delete(roomId);
	}
	await saveGameState(roomId, gameState);

	broadcastToAll(roomId, {
		type: 'game-ended',
		winner: winner?.userId || null,
		finalScores: gameState.players,
	});

	const timer = gameTimers.get(roomId);
	if (timer) {
		clearTimeout(timer);
		gameTimers.delete(roomId);
	}

	scheduleRoomCleanup(roomId);
}

function scheduleRoomCleanup(roomId: string) {
	const existingTimer = roomCleanupTimers.get(roomId);
	if (existingTimer) {
		clearTimeout(existingTimer);
		roomCleanupTimers.delete(roomId);
	}

	const timer = setTimeout(
		async () => {
			const gameState = await getGameState(roomId);
			if (!gameState || gameState.players.every((p) => !p.isConnected)) {
				await cleanupRoom(roomId);
			}
			roomCleanupTimers.delete(roomId);
		},
		10 * 60 * 1000
	);

	roomCleanupTimers.set(roomId, timer);
}

function clearGameTimer(roomId: string) {
	const timer = gameTimers.get(roomId);
	if (timer) {
		clearTimeout(timer);
		gameTimers.delete(roomId);
	}
	// 同时也清除同步定时器
	const syncTimer = syncTimers.get(roomId);
	if (syncTimer) {
		clearInterval(syncTimer);
		syncTimers.delete(roomId);
	}
}

async function cleanupRoom(roomId: string) {
	try {
		console.log(`正在清理房间 ${roomId}`);
		// 先清理内存，停止所有定时器
		clearGameTimer(roomId);
		roomConnections.delete(roomId);
		gameStates.delete(roomId);
		roomUsers.delete(roomId);

		// 再清理数据库
		await db
			.delete(colorClashPlayers)
			.where(eq(colorClashPlayers.roomId, roomId));
		await db.delete(colorClashRooms).where(eq(colorClashRooms.id, roomId));
	} catch (error) {
		console.error('清理颜色对抗房间失败:', error);
	}
}

function calculatePixelScore(
	// canvasWidth: number,
	// canvasHeight: number,
	colorData: Uint8ClampedArray,
	playerColor: string
): number {
	let score = 0;
	const targetColor: { r: number; g: number; b: number } =
		parseColorString(playerColor);

	for (let i = 0; i < colorData.length; i += 4) {
		const r = colorData[i] as number;
		const g = colorData[i + 1] as number;
		const b = colorData[i + 2] as number;
		if (
			Math.abs(r - targetColor.r!) < 10 &&
			Math.abs(g - targetColor.g!) < 10 &&
			Math.abs(b - targetColor.b!) < 10
		) {
			score++;
		}
	}
	return score;
}

function parseColorString(color: string): { r: number; g: number; b: number } {
	const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
	if (match && match[1] && match[2] && match[3]) {
		const r = parseInt(match[1], 10);
		const g = parseInt(match[2], 10);
		const b = parseInt(match[3], 10);
		if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
			return { r, g, b };
		}
	}
	// 返回默认颜色
	return { r: 255, g: 255, b: 255 };
}

async function addPlayerToRoom(
	roomId: string,
	userId: string,
	username: string
): Promise<void> {
	try {
		const existing = await db
			.select()
			.from(colorClashPlayers)
			.where(
				and(
					eq(colorClashPlayers.roomId, roomId),
					eq(colorClashPlayers.userId, userId)
				)
			)
			.limit(1);

		if (existing.length === 0) {
			await db.insert(colorClashPlayers).values({
				roomId,
				userId,
				username,
				color: `rgb(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)})`,
				score: 0,
				isConnected: true,
				lastActivity: new Date(),
			});
		} else {
			await db
				.update(colorClashPlayers)
				.set({ isConnected: true, lastActivity: new Date() })
				.where(
					and(
						eq(colorClashPlayers.roomId, roomId),
						eq(colorClashPlayers.userId, userId)
					)
				);
		}
	} catch (error) {
		console.error('Error adding player to room:', error);
		throw error;
	}
}

export const colorClashWsRoute = new Elysia()
	.use(optionalAuth)
	.derive(() => ({ connectionId: crypto.randomUUID() }))
	.ws('/ws/color-clash', {
		query: t.Object({
			roomId: t.String(),
		}),
		body: t.Union([
			t.Object({ type: t.Literal('join-room'), roomId: t.String() }),
			t.Object({ type: t.Literal('leave-room') }),
			t.Object({
				type: t.Literal('draw'),
				data: t.Object({
					x: t.Number(),
					y: t.Number(),
					color: t.String(),
					size: t.Number(),
				}),
			}),
			t.Object({ type: t.Literal('game-start') }),
			t.Object({
				type: t.Literal('game-chat'),
				message: t.String(),
				username: t.String(),
				id: t.Optional(t.String()),
			}),
			t.Object({ type: t.Literal('ping') }),
		]),

		async open(ws) {
			const user = ws.data.user;
			const userId = user.id.toString();
			const username = user.name;
			const { roomId } = ws.data.query;

			// 管理连接
			const existingConnection = userConnections.get(userId);
			if (existingConnection) {
				try {
					existingConnection.close();
				} catch {
					// 忽略连接关闭错误
				}
				roomConnections.forEach((connections) => {
					connections.delete(existingConnection as unknown as WebSocket);
				});
			}

			userConnections.set(userId, ws as unknown as WebSocket);
			ws.subscribe(roomId);

			if (!roomConnections.has(roomId)) roomConnections.set(roomId, new Set());
			roomConnections.get(roomId)!.add(ws as unknown as WebSocket);

			if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Set());
			roomUsers.get(roomId)!.add(userId);

			const cleanupTimer = roomCleanupTimers.get(roomId);
			if (cleanupTimer) {
				clearTimeout(cleanupTimer);
				roomCleanupTimers.delete(roomId);
			}

			ws.send(
				JSON.stringify({
					type: 'connected',
					userId,
					username,
					roomId,
					timestamp: Date.now(),
				})
			);

			// 初始化游戏状态
			let gameState = gameStates.get(roomId) || (await getGameState(roomId));

			if (!gameState) {
				const dbRoom = await db
					.select()
					.from(colorClashRooms)
					.where(eq(colorClashRooms.id, roomId))
					.limit(1);
				if (!dbRoom[0]) {
					ws.send(JSON.stringify({ type: 'error', message: '房间不存在' }));
					ws.close();
					return;
				}
				gameState = {
					mode: 'color-clash',
					isActive: false,
					gameStartTime: null,
					gameTimeLimit: 300,
					players: [],
					canvasWidth: dbRoom[0].canvasWidth || 800,
					canvasHeight: dbRoom[0].canvasHeight || 600,
					colorData: null,
					winner: null,
					gameEndTime: null,
					room: {
						id: dbRoom[0].id,
						name: dbRoom[0].name,
						ownerId: dbRoom[0].ownerId,
						ownerName: dbRoom[0].ownerName,
						maxPlayers: dbRoom[0].maxPlayers,
						gameTime: dbRoom[0].gameTime,
						canvasWidth: dbRoom[0].canvasWidth,
						canvasHeight: dbRoom[0].canvasHeight,
						isPrivate: dbRoom[0].isPrivate ?? false,
						status: dbRoom[0].status,
						createdAt: dbRoom[0].createdAt || new Date(),
					},
				};
			}
			gameStates.set(roomId, gameState!);

			// 处理玩家进入
			const existingPlayer = gameState.players.find(
				(p: ColorClashPlayer) => p.userId === userId
			);
			if (!existingPlayer) {
				await addPlayerToRoom(roomId, userId, username);
				const newPlayer = {
					userId,
					username,
					color: `rgb(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)})`,
					score: 0,
					isConnected: true,
					lastActivity: Date.now(),
					x: Math.floor(gameState.canvasWidth / 2),
					y: Math.floor(gameState.canvasHeight / 2),
				};
				gameState.players.push(newPlayer);

				// 广播新玩家加入给其他玩家
				broadcastToRoomExcept(
					roomId,
					{
						type: 'player-joined',
						player: newPlayer,
					},
					ws as unknown as WebSocket
				);
			} else {
				existingPlayer.username = username;
				existingPlayer.isConnected = true;
				existingPlayer.lastActivity = Date.now();
			}

			// 发送房间信息
			try {
				const dbRoom = await db
					.select()
					.from(colorClashRooms)
					.where(eq(colorClashRooms.id, roomId))
					.limit(1);
				if (dbRoom[0]) {
					const playerCount = await db
						.select({ count: sql<number>`COUNT(*)` })
						.from(colorClashPlayers)
						.where(eq(colorClashPlayers.roomId, roomId));

					const roomData = {
						...processRoomDateFields(dbRoom[0]),
						currentPlayers: playerCount[0]?.count || 0,
					};

					ws.send(
						JSON.stringify({
							type: 'room-joined',
							room: roomData,
							players: gameState.players,
						})
					);
				}
			} catch (error) {
				console.error('加入房间响应错误:', error);
			}
		},

		async message(ws, message) {
			const user = ws.data.user;
			const userId = user.id.toString();
			const username = user.name;
			const { roomId } = ws.data.query;

			try {
				// 使用类型守卫确保消息类型正确
				if (!isColorClashClientMessage(message)) {
					console.error('Invalid message type:', message);
					return;
				}

				switch (message.type) {
					case 'draw': {
						let gameState: ColorClashGameState | undefined =
							gameStates.get(roomId);
						if (!gameState) {
							// 仅在内存中没有时才去查库，减少读取压力
							const fetchedState = await getGameState(roomId);
							if (fetchedState) {
								gameStates.set(roomId, fetchedState);
								gameState = fetchedState;
							}
						}

						if (!gameState || !gameState.isActive) return;

						const player = gameState.players.find((p) => p.userId === userId);
						if (!player) return;

						player.x = message.data.x;
						player.y = message.data.y;

						if (!gameState.colorData) {
							gameState.colorData = new Uint8ClampedArray(
								gameState.canvasWidth * gameState.canvasHeight * 4
							);
							gameState.colorData.fill(255);
						}

						const { x, y, color, size } = message.data;
						const targetColor = parseColorString(color);

						for (let dy = -size; dy <= size; dy++) {
							for (let dx = -size; dx <= size; dx++) {
								if (Math.sqrt(dx * dx + dy * dy) <= size) {
									const px = Math.floor(x + dx);
									const py = Math.floor(y + dy);
									if (
										px >= 0 &&
										px < gameState.canvasWidth &&
										py >= 0 &&
										py < gameState.canvasHeight
									) {
										const index = (py * gameState.canvasWidth + px) * 4;
										gameState.colorData[index] = targetColor.r;
										gameState.colorData[index + 1] = targetColor.g;
										gameState.colorData[index + 2] = targetColor.b;
										gameState.colorData[index + 3] = 255;
									}
								}
							}
						}

						// 计算分数 (CPU密集型，如果卡顿可考虑降频计算)
						const updatedScores = gameState.players.map((p) => {
							const score = calculatePixelScore(
								// gameState!.canvasWidth,
								// gameState!.canvasHeight,
								gameState!.colorData!,
								p.color
							);
							return { userId: p.userId, score };
						});

						updatedScores.forEach(({ userId, score }) => {
							const p = gameState!.players.find((p) => p.userId === userId);
							if (p) p.score = score;
						});

						// 只更新内存状态
						gameStates.set(roomId, gameState);

						// 广播更新
						const connections = roomConnections.get(roomId);
						if (connections && connections.size > 1) {
							const drawMessage = JSON.stringify({
								type: 'draw-update',
								data: message.data,
								userId,
							});
							const scoreMessage = JSON.stringify({
								type: 'score-update',
								scores: updatedScores,
							});

							connections.forEach((conn) => {
								if (
									conn !== (ws as unknown as WebSocket) &&
									conn.readyState === WebSocket.OPEN
								) {
									conn.send(drawMessage);
									conn.send(scoreMessage);
								}
							});
						}
						break;
					}

					case 'game-start': {
						// 启动逻辑...
						const gameState =
							gameStates.get(roomId) || (await getGameState(roomId));
						if (!gameState) return;
						if (gameState.isActive) return;

						// 只有房主才能启动游戏
						const room = await db
							.select()
							.from(colorClashRooms)
							.where(eq(colorClashRooms.id, roomId))
							.limit(1);
						if (room[0] && room[0].ownerId === userId) {
							await startGame(roomId);
						}
						break;
					}

					case 'game-chat': {
						if (ws.readyState !== WebSocket.OPEN) break;
						const { message: chatMsg, id } = message;
						if (!chatMsg || chatMsg.length > 500) break;

						const connections = roomConnections.get(roomId);
						if (connections) {
							const payload = JSON.stringify({
								type: 'game-chat',
								message: chatMsg,
								username,
								timestamp: Date.now(),
								id,
							});
							connections.forEach((conn) => {
								if (conn.readyState === WebSocket.OPEN) conn.send(payload);
							});
						}
						break;
					}

					case 'ping':
						ws.send(JSON.stringify({ type: 'pong' }));
						break;

					case 'leave-room':
						ws.close();
						break;
				}
			} catch (error) {
				console.error('WS Message Error:', error);
			}
		},

		async close(ws) {
			const { user } = ws.data;
			const userId = user.id.toString();
			const { roomId } = ws.data.query;

			userConnections.delete(userId);

			const connections = roomConnections.get(roomId);
			if (connections) {
				connections.delete(ws as unknown as WebSocket);
				if (connections.size === 0) roomConnections.delete(roomId);
			}

			const room = roomUsers.get(roomId);
			if (room) room.delete(userId);

			const gameState = gameStates.get(roomId) || (await getGameState(roomId));
			if (gameState) {
				gameStates.set(roomId, gameState);
				const playerIndex = gameState.players.findIndex(
					(p) => p.userId === userId
				);
				if (playerIndex !== -1) {
					gameState.players.splice(playerIndex, 1); // 从数组中移除玩家
				}

				// 检查房主是否离开，如果是则随机选择新房主
				if (gameState.room.ownerId === userId) {
					const connectedPlayers = gameState.players.filter(
						(p) => p.isConnected
					);
					if (connectedPlayers.length > 0) {
						const newOwner =
							connectedPlayers[
								Math.floor(Math.random() * connectedPlayers.length)
							];
						if (newOwner) {
							gameState.room.ownerId = newOwner.userId;
							gameState.room.ownerName = newOwner.username;
							broadcastToAll(roomId, {
								type: 'owner-changed',
								newOwnerId: newOwner.userId,
								newOwnerName: newOwner.username,
							});
						}
					}
				}

				// 检查是否只剩一人
				if (
					gameState.isActive &&
					gameState.players.filter((p) => p.isConnected).length === 1
				) {
					const remaining = gameState.players.find((p) => p.isConnected);
					if (remaining) {
						remaining.score += 500;
						const victoryMsg = {
							type: 'game-ended' as const,
							winner: remaining.userId,
							finalScores: gameState.players,
						};
						broadcastToAll(roomId, victoryMsg);

						// 结束游戏逻辑
						gameState.isActive = false;
						gameStates.set(roomId, gameState);

						// 清理并立即保存
						if (syncTimers.has(roomId)) {
							clearInterval(syncTimers.get(roomId));
							syncTimers.delete(roomId);
						}
						await saveGameState(roomId, gameState);
						clearGameTimer(roomId);
						return;
					}
				}

				// 玩家离开时保存一次状态，以防数据丢失
				await saveGameState(roomId, gameState);
			}

			broadcastToAll(roomId, {
				type: 'player-left',
				userId,
			});

			// 检查空房间
			try {
				// 更新DB状态
				await db
					.update(colorClashPlayers)
					.set({ isConnected: false, lastActivity: new Date() })
					.where(
						and(
							eq(colorClashPlayers.roomId, roomId),
							eq(colorClashPlayers.userId, userId)
						)
					);
			} catch (e) {
				console.error(e);
			}

			if (gameState?.players.every((p) => !p.isConnected)) {
				scheduleRoomCleanup(roomId);
			}
		},
	});
