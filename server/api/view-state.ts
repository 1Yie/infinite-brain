import { Elysia } from 'elysia';
import { db } from '../db';
import { viewStates } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '../utils/verify';

export const viewStateApi = new Elysia({ prefix: '/view-state' })
	.use(auth)

	// 获取视图状态
	.get('/:roomId', async ({ params, user }) => {
		const { roomId } = params;

		const result = await db
			.select()
			.from(viewStates)
			.where(
				and(
					eq(viewStates.userId, user.id.toString()),
					eq(viewStates.roomId, roomId)
				)
			)
			.limit(1);

		if (result.length > 0) {
			const state = result[0]!;
			return {
				offset: { x: state.offsetX, y: state.offsetY },
				scale: state.scale / 100, // 存储时乘以100，这里除回去
			};
		}

		return null; // 没有保存的视图状态
	})

	// 保存视图状态
	.post('/:roomId', async ({ params, body, user }) => {
		const { roomId } = params;
		const { offset, scale } = body as {
			offset: { x: number; y: number };
			scale: number;
		};

		// 使用upsert操作：如果存在就更新，不存在就插入
		await db
			.insert(viewStates)
			.values({
				userId: user.id.toString(),
				roomId,
				offsetX: Math.round(offset.x),
				offsetY: Math.round(offset.y),
				scale: Math.round(scale * 100), // 乘以100存储为整数
			})
			.onConflictDoUpdate({
				target: [viewStates.userId, viewStates.roomId],
				set: {
					offsetX: Math.round(offset.x),
					offsetY: Math.round(offset.y),
					scale: Math.round(scale * 100),
					updatedAt: new Date(),
				},
			});

		return { success: true };
	});
