import { Elysia, t } from 'elysia';
import { db } from '../db';
import { rooms, strokes } from '../db/schema';
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
	);
