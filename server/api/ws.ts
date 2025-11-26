import { Elysia, t } from 'elysia';
import { db } from '../db';
import { strokes, userStats } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { optionalAuth } from '../utils/verify';

const DrawDataSchema = t.Object({
	x: t.Number(),
	y: t.Number(),
	prevX: t.Optional(t.Number()),
	prevY: t.Optional(t.Number()),
	color: t.Optional(t.String()),
	size: t.Optional(t.Number()),
	tool: t.Optional(t.String()),
});

const StrokePointSchema = t.Object({
	x: t.Number(),
	y: t.Number(),
});

const StrokeFinishSchema = t.Object({
	id: t.String(),
	tool: t.String(),
	color: t.String(),
	size: t.Number(),
	points: t.Array(StrokePointSchema),
});

const CursorDataSchema = t.Object({
	x: t.Number(),
	y: t.Number(),
});

const MessageSchema = t.Object({
	type: t.Union([
		t.Literal('draw'),
		t.Literal('stroke-finish'),
		t.Literal('clear'),
		t.Literal('undo'),
		t.Literal('redo'),
		t.Literal('cursor'),
	]),
	data: t.Optional(
		t.Union([DrawDataSchema, StrokeFinishSchema, CursorDataSchema, t.Any()])
	),
});

const roomUsers = new Map<string, Set<string>>();

export const websocketRoutes = new Elysia({ prefix: '/ws' })
	.use(optionalAuth)
	.derive(() => {
		return {
			connectionId: crypto.randomUUID(),
		};
	})

	.ws('/board', {
		query: t.Object({
			roomId: t.String(),
		}),

		body: MessageSchema,

		async open(ws) {
			const user = ws.data.user;
			const userId = user.id.toString();
			const username = user.name;
			const { roomId } = ws.data.query;

			if (!roomUsers.has(roomId)) {
				roomUsers.set(roomId, new Set());
			}
			const currentRoom = roomUsers.get(roomId)!;
			currentRoom.add(userId);

			console.log(
				`用户 ${username}(${userId}) 进入房间 ${roomId} | 当前房间在线: ${currentRoom.size}`
			);

			ws.subscribe(roomId);

			ws.send({
				type: 'connected',
				userId,
				username,
				roomId,
				timestamp: Date.now(),
			});

			try {
				const history = await db
					.select()
					.from(strokes)
					.where(and(eq(strokes.roomId, roomId), eq(strokes.isDeleted, false)))
					.orderBy(strokes.createdAt);

				const historyData = history.map((row) => row.data);

				ws.send({
					type: 'history-sync',
					data: historyData,
					timestamp: Date.now(),
				});
			} catch (error) {
				console.error('加载历史记录失败:', error);
			}

			ws.publish(roomId, {
				type: 'user-joined',
				userId,
				username,
				userCount: currentRoom.size,
				timestamp: Date.now(),
			});
		},

		async message(ws, message) {
			const user = ws.data.user;
			const userId = user.id.toString();
			const { roomId } = ws.data.query;

			const broadcastMsg = {
				...message,
				userId,
				timestamp: Date.now(),
			};

			switch (message.type) {
				case 'draw':
					ws.publish(roomId, broadcastMsg);
					break;

				case 'stroke-finish':
					try {
						const strokeData = message.data;
						const pixelCount = strokeData.points?.length || 0;

						// 保存笔画
						await db.insert(strokes).values({
							id: strokeData.id || crypto.randomUUID(),
							roomId: roomId,
							userId: userId,
							data: strokeData,
						});

						// 更新用户统计
						const today = new Date();
						today.setHours(0, 0, 0, 0);

						// 检查是否已有统计记录
						const existingStats = await db
							.select()
							.from(userStats)
							.where(eq(userStats.userId, userId))
							.limit(1);

						if (existingStats.length > 0) {
							const stats = existingStats[0]!;
							// 检查是否是新的一天 - 使用本地日期比较
							const now = new Date();
							const lastUpdated = new Date(stats.lastUpdated || now);

							const isSameDay =
								now.getFullYear() === lastUpdated.getFullYear() &&
								now.getMonth() === lastUpdated.getMonth() &&
								now.getDate() === lastUpdated.getDate();

							if (isSameDay) {
								// 同一天，累加今日数据
								await db
									.update(userStats)
									.set({
										totalStrokes: (stats.totalStrokes || 0) + 1,
										todayStrokes: (stats.todayStrokes || 0) + 1,
										totalPixels: (stats.totalPixels || 0) + pixelCount,
										todayPixels: (stats.todayPixels || 0) + pixelCount,
										lastUpdated: now,
									})
									.where(eq(userStats.userId, userId));
							} else {
								// 新的一天，重置今日数据
								await db
									.update(userStats)
									.set({
										totalStrokes: (stats.totalStrokes || 0) + 1,
										todayStrokes: 1,
										totalPixels: (stats.totalPixels || 0) + pixelCount,
										todayPixels: pixelCount,
										lastUpdated: now,
									})
									.where(eq(userStats.userId, userId));
							}
						} else {
							// 首次创建统计记录
							await db.insert(userStats).values({
								userId: userId,
								totalStrokes: 1,
								todayStrokes: 1,
								totalPixels: pixelCount,
								todayPixels: pixelCount,
							});
						}
					} catch (e) {
						console.error('保存笔画失败:', e);
					}
					break;

				case 'clear':
					console.warn(`用户 ${userId} 尝试清除画布，但该操作已被禁用`);
					ws.send({
						type: 'clear-disabled',
						message: '清除画布功能已被禁用，无法执行此操作',
						timestamp: Date.now(),
					});
					break;

				case 'cursor':
					ws.publish(roomId, broadcastMsg);
					break;

				case 'undo':
					try {
						// 查找该用户最后一条未删除的笔画记录
						const lastStroke = await db
							.select()
							.from(strokes)
							.where(
								and(
									eq(strokes.userId, userId),
									eq(strokes.roomId, roomId),
									eq(strokes.isDeleted, false)
								)
							)
							.orderBy(desc(strokes.createdAt))
							.limit(1);

						if (lastStroke.length > 0) {
							const strokeId = lastStroke[0]!.id;
							// 标记为已删除而不是物理删除
							await db
								.update(strokes)
								.set({ isDeleted: true })
								.where(eq(strokes.id, strokeId));
						}

						// 广播撤销消息
						ws.publish(roomId, {
							type: 'undo',
							userId,
							timestamp: Date.now(),
						});
					} catch (e) {
						console.error('撤销笔画失败:', e);
					}
					break;

				case 'redo':
					try {
						// 查找该用户最后一条已删除的笔画记录
						const lastDeletedStroke = await db
							.select()
							.from(strokes)
							.where(
								and(
									eq(strokes.userId, userId),
									eq(strokes.roomId, roomId),
									eq(strokes.isDeleted, true)
								)
							)
							.orderBy(desc(strokes.createdAt))
							.limit(1);

						if (lastDeletedStroke.length > 0) {
							const strokeId = lastDeletedStroke[0]!.id;
							// 恢复已删除的笔画
							await db
								.update(strokes)
								.set({ isDeleted: false })
								.where(eq(strokes.id, strokeId));

							// 广播重做消息
							ws.publish(roomId, {
								type: 'redo',
								data: lastDeletedStroke[0]!.data,
								userId,
								timestamp: Date.now(),
							});
						}
					} catch (e) {
						console.error('重做笔画失败:', e);
					}
					break;
			}
		},

		close(ws) {
			const user = ws.data.user;
			const userId = user.id.toString();
			const username = user.name;
			const { roomId } = ws.data.query;

			const currentRoom = roomUsers.get(roomId);
			if (currentRoom) {
				currentRoom.delete(userId);
				if (currentRoom.size === 0) {
					roomUsers.delete(roomId);
				}

				console.log(
					`用户 ${username} 离开房间 ${roomId} | 剩余: ${currentRoom.size}`
				);

				ws.unsubscribe(roomId);

				ws.publish(roomId, {
					type: 'user-left',
					userId,
					username,
					userCount: currentRoom.size,
					timestamp: Date.now(),
				});
			}
		},
	});
