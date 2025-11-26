import { Elysia, t } from 'elysia';
import { db } from '../db';
import { rooms, strokes, userStats } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { auth } from '../utils/verify';

export const roomRoutes = new Elysia({ prefix: '/rooms' })
	.use(auth)

	.get('/', async () => {
		try {
			const allRooms = await db
				.select()
				.from(rooms)
				.orderBy(desc(rooms.createdAt));
			return { success: true, data: allRooms };
		} catch (e) {
			console.error(e);
			return { success: false, error: '获取房间列表失败' };
		}
	})

	.post(
		'/create',
		async ({ body, user }) => {
			const roomId = crypto.randomUUID();
			try {
				await db.insert(rooms).values({
					id: roomId,
					name: body.name,
					ownerId: user.id.toString(),
					isPrivate: body.isPrivate || false,
					password: body.password || null,
					createdAt: new Date(),
				});
				return { success: true, roomId, name: body.name };
			} catch (e) {
				console.error(e);
				return { success: false, error: '创建房间失败' };
			}
		},
		{
			body: t.Object({
				name: t.String({ minLength: 1, maxLength: 50 }),
				isPrivate: t.Optional(t.Boolean()),
				password: t.Optional(t.String()),
			}),
		}
	)

	.delete(
		'/:id',
		async ({ params, user }) => {
			const room = await db.query.rooms.findFirst({
				where: eq(rooms.id, params.id),
			});

			if (!room) throw new Error('房间不存在');
			if (room.ownerId !== user.id.toString())
				throw new Error('无权删除此房间');

			try {
				await db.transaction(async (tx) => {
					await tx.delete(strokes).where(eq(strokes.roomId, params.id));
					await tx.delete(rooms).where(eq(rooms.id, params.id));
				});

				return { success: true };
			} catch (e) {
				console.error(e);
				return { success: false, error: '删除房间失败' };
			}
		},
		{
			params: t.Object({
				id: t.String(),
			}),
		}
	)
	.post(
		'/join',
		async ({ body }) => {
			try {
				const room = await db.query.rooms.findFirst({
					where: eq(rooms.id, body.roomId),
				});

				if (!room) {
					return { success: false, error: '房间不存在' };
				}

				if (room.isPrivate) {
					if (!body.password || room.password !== body.password) {
						return { success: false, error: '密码错误' };
					}
				}

				return { success: true, room };
			} catch (e) {
				console.error(e);
				return { success: false, error: '加入房间失败' };
			}
		},
		{
			body: t.Object({
				roomId: t.String(),
				password: t.Optional(t.String()),
			}),
		}
	)

	// 获取用户统计数据
	.get('/stats', async ({ user }) => {
		try {
			const userId = user.id.toString();
			const stats = await db
				.select()
				.from(userStats)
				.where(eq(userStats.userId, userId))
				.limit(1);

			if (stats.length > 0) {
				const stat = stats[0]!;
				return {
					success: true,
					data: {
						totalStrokes: stat.totalStrokes || 0,
						todayStrokes: stat.todayStrokes || 0,
						totalPixels: stat.totalPixels || 0,
						todayPixels: stat.todayPixels || 0,
					},
				};
			} else {
				// 如果没有统计记录，返回默认值
				return {
					success: true,
					data: {
						totalStrokes: 0,
						todayStrokes: 0,
						totalPixels: 0,
						todayPixels: 0,
					},
				};
			}
		} catch (e) {
			console.error('获取统计数据失败:', e);
			return { success: false, error: '获取统计数据失败' };
		}
	});
