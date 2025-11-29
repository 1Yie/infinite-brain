import { Elysia, t } from 'elysia';
import { db } from '../db';
import { colorClashRooms, colorClashPlayers } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { auth } from '../utils/verify';

// 生成房间ID
async function generateRoomId(): Promise<string> {
	let roomId = '';
	let isUnique = false;

	while (!isUnique) {
		roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
		const existingRoom = await db
			.select()
			.from(colorClashRooms)
			.where(eq(colorClashRooms.id, roomId))
			.limit(1);
		isUnique = existingRoom.length === 0;
	}

	return roomId;
}

// 颜色对抗游戏房间API
export const colorClashRoutes = new Elysia({ prefix: '/color-clash' })
	.use(auth)
	// 获取房间列表
	.get('/rooms', async () => {
		try {
			const rooms = await db
				.select({
					id: colorClashRooms.id,
					name: colorClashRooms.name,
					ownerId: colorClashRooms.ownerId,
					ownerName: colorClashRooms.ownerName,
					maxPlayers: colorClashRooms.maxPlayers,
					currentPlayers: sql<number>`COUNT(${colorClashPlayers.id})`,
					gameTime: colorClashRooms.gameTime,
					canvasWidth: colorClashRooms.canvasWidth,
					canvasHeight: colorClashRooms.canvasHeight,
					isPrivate: colorClashRooms.isPrivate,
					status: colorClashRooms.status,
					createdAt: colorClashRooms.createdAt,
				})
				.from(colorClashRooms)
				.leftJoin(
					colorClashPlayers,
					and(
						eq(colorClashRooms.id, colorClashPlayers.roomId),
						eq(colorClashPlayers.isConnected, true)
					)
				)
				.where(eq(colorClashRooms.status, 'waiting'))
				.groupBy(colorClashRooms.id)
				.orderBy(sql`${colorClashRooms.createdAt} DESC`);

			return {
				success: true,
				data: rooms.map((room) => ({
					...room,
					createdAt: (() => {
						try {
							return room.createdAt
								? new Date(room.createdAt).toISOString()
								: null;
						} catch {
							return null;
						}
					})(),
				})),
			};
		} catch (error) {
			console.error('获取颜色对抗房间列表失败:', error);
			return {
				success: false,
				error: { message: '获取房间列表失败' },
			};
		}
	})

	// 创建房间
	.post(
		'/rooms',
		async ({ body, user }) => {
			console.log('创建房间请求体:', JSON.stringify(body, null, 2));
			try {
				const {
					name,
					maxPlayers,
					gameTime,
					canvasWidth,
					canvasHeight,
					isPrivate,
					password,
				} = body.json || body;

				const roomId = await generateRoomId();

				// 创建房间
				const [room] = await db
					.insert(colorClashRooms)
					.values({
						id: roomId,
						name,
						ownerId: user.id.toString(),
						ownerName: user.name,
						maxPlayers: Number(maxPlayers),
						gameTime: Number(gameTime),
						canvasWidth: Number(canvasWidth),
						canvasHeight: Number(canvasHeight),
						isPrivate,
						password: isPrivate ? password : null,
						status: 'waiting',
					})
					.returning();

				return {
					success: true,
					data: room,
				};
			} catch (error) {
				console.error('创建颜色对抗房间失败:', error);
				return {
					success: false,
					error: { message: '创建房间失败' },
				};
			}
		},
		{
			body: t.Any(),
		}
	)

	// 加入房间
	.post(
		'/:roomId/join',
		async ({ params, body, user }) => {
			try {
				const { roomId } = params;
				const { password } = body;

				// 获取房间信息
				const [room] = await db
					.select()
					.from(colorClashRooms)
					.where(eq(colorClashRooms.id, roomId));

				if (!room) {
					return {
						success: false,
						error: { message: '房间不存在' },
					};
				}

				if (room.status !== 'waiting') {
					return {
						success: false,
						error: { message: '房间已开始游戏' },
					};
				}

				// 检查密码
				if (room.isPrivate && room.password !== password) {
					return {
						success: false,
						error: { message: '密码错误' },
					};
				}

				// 检查房间是否已满
				const playerCount = await db
					.select({ count: sql<number>`COUNT(*)` })
					.from(colorClashPlayers)
					.where(eq(colorClashPlayers.roomId, roomId));

				if (playerCount[0] && playerCount[0].count >= room.maxPlayers) {
					return {
						success: false,
						error: { message: '房间已满' },
					};
				}

				// 如果房间没人，第一个加入的玩家成为房主
				if (playerCount[0] && playerCount[0].count === 0) {
					await db
						.update(colorClashRooms)
						.set({
							ownerId: user.id.toString(),
							ownerName: user.name,
						})
						.where(eq(colorClashRooms.id, roomId));
				}

				// 检查玩家是否已在房间中
				const [existingPlayer] = await db
					.select()
					.from(colorClashPlayers)
					.where(
						and(
							eq(colorClashPlayers.roomId, roomId),
							eq(colorClashPlayers.userId, user.id.toString())
						)
					);

				if (existingPlayer) {
					return {
						success: true,
						data: {
							room,
							player: existingPlayer,
						},
					};
				}

				// 加入房间 (先不设置 isConnected = true，等待 WebSocket 连接)
				const [player] = await db
					.insert(colorClashPlayers)
					.values({
						roomId,
						userId: user.id.toString(),
						username: user.name,
						color: generateRandomColor(),
						score: 0,
						isConnected: false, // 等待 WebSocket 连接时设置为 true
					})
					.returning();

				return {
					success: true,
					data: {
						room: {
							...room,
							ownerId:
								playerCount[0] && playerCount[0].count === 0
									? user.id.toString()
									: room.ownerId,
							ownerName:
								playerCount[0] && playerCount[0].count === 0
									? user.name
									: room.ownerName,
						},
						player,
					},
				};
			} catch (error) {
				console.error('加入颜色对抗房间失败:', error);
				return {
					success: false,
					error: { message: '加入房间失败' },
				};
			}
		},
		{
			body: t.Object({
				password: t.Optional(t.String()),
			}),
		}
	)

	// 获取房间详情
	.get('/:roomId', async ({ params }) => {
		try {
			const { roomId } = params;

			// 获取房间信息
			const [room] = await db
				.select()
				.from(colorClashRooms)
				.where(eq(colorClashRooms.id, roomId));

			if (!room) {
				return {
					success: false,
					error: { message: '房间不存在' },
				};
			}

			// 获取房间玩家
			const players = await db
				.select()
				.from(colorClashPlayers)
				.where(eq(colorClashPlayers.roomId, roomId));

			return {
				success: true,
				data: { room, players },
			};
		} catch (error) {
			console.error('获取颜色对抗房间详情失败:', error);
			return {
				success: false,
				error: { message: '获取房间详情失败' },
			};
		}
	})

	// 离开房间
	.post('/:roomId/leave', async ({ params, user }) => {
		try {
			const { roomId } = params;

			// 删除玩家
			await db
				.delete(colorClashPlayers)
				.where(
					and(
						eq(colorClashPlayers.roomId, roomId),
						eq(colorClashPlayers.userId, user.id.toString())
					)
				);

			// 检查房间是否还有玩家，如果没有则删除房间
			const playerCount = await db
				.select({ count: sql<number>`COUNT(*)` })
				.from(colorClashPlayers)
				.where(eq(colorClashPlayers.roomId, roomId));

			if (playerCount[0] && playerCount[0].count === 0) {
				await db.delete(colorClashRooms).where(eq(colorClashRooms.id, roomId));
			}

			return {
				success: true,
			};
		} catch (error) {
			console.error('离开颜色对抗房间失败:', error);
			return {
				success: false,
				error: { message: '离开房间失败' },
			};
		}
	});

// 生成随机颜色的辅助函数
function generateRandomColor(): string {
	const colors = [
		'rgb(255, 0, 0)', // 红
		'rgb(0, 255, 0)', // 绿
		'rgb(0, 0, 255)', // 蓝
		'rgb(255, 255, 0)', // 黄
		'rgb(255, 0, 255)', // 紫
		'rgb(0, 255, 255)', // 青
		'rgb(255, 165, 0)', // 橙
		'rgb(128, 0, 128)', // 深紫
		'rgb(0, 128, 0)', // 深绿
		'rgb(128, 128, 0)', // 橄榄
	];

	const color = colors[Math.floor(Math.random() * colors.length)];
	return color!;
}
