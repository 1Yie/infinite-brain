import { Elysia, t } from 'elysia';
import { db } from '../../db';
import { strokes, userStats } from '../../db/schema';
import { eq, desc, and, asc } from 'drizzle-orm';
import { optionalAuth } from '../../utils/verify';
import { BoardMessageSchema } from '../../types';

const roomUsers = new Map<string, Set<string>>();

export const boardRoute = new Elysia({ prefix: '/ws' })
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

		body: BoardMessageSchema,

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
							createdAt: strokeData.createdAt
								? new Date(strokeData.createdAt)
								: new Date(),
						});

						// 广播笔画完成消息给房间内所有用户
						ws.publish(roomId, {
							type: 'stroke-finished',
							data: strokeData,
							userId,
							timestamp: Date.now(),
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
						let strokeId = message.strokeId; // 使用客户端传递的strokeId

						// 如果客户端没有传递strokeId，则查找用户最新的笔画
						if (!strokeId) {
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
								strokeId = lastStroke[0]!.id;
							}
						} else {
							// 如果客户端传递了strokeId，需要验证这个笔画是否属于当前用户
							const strokeToCheck = await db
								.select()
								.from(strokes)
								.where(
									and(
										eq(strokes.id, strokeId),
										eq(strokes.roomId, roomId),
										eq(strokes.isDeleted, false)
									)
								)
								.limit(1);

							// 如果笔画不存在或属于其他用户，则不允许撤销
							if (
								strokeToCheck.length === 0 ||
								strokeToCheck[0]!.userId !== userId
							) {
								console.warn(
									`用户 ${userId} 尝试撤销不属于自己的笔画ID: ${strokeId}`
								);
								// 直接返回，不发送任何消息，客户端会认为操作无效
								return;
							}
						}

						if (strokeId) {
							console.log(`撤销笔画: 用户 ${userId}, 笔画ID: ${strokeId}`);
							// 标记为已删除而不是物理删除
							await db
								.update(strokes)
								.set({ isDeleted: true })
								.where(eq(strokes.id, strokeId));

							// 广播撤销消息，携带被删除的笔画 id，让前端精确删除
							ws.publish(roomId, {
								type: 'undo',
								strokeId: strokeId,
								userId,
								timestamp: Date.now(),
							});
						} else {
							// 没有可撤销的笔画，仍广播（让客户端知道无操作）
							ws.publish(roomId, {
								type: 'undo',
								strokeId: null,
								userId,
								timestamp: Date.now(),
							});
						}
					} catch (e) {
						console.error('撤销笔画失败:', e);
					}
					break;

				case 'redo':
					try {
						if (message.data) {
							// 前端发送了具体的笔画数据，直接广播并保存
							console.log(
								`重做笔画: 用户 ${userId}, 笔画ID: ${message.data.id}`
							);
							// 尝试更新，如果不存在则插入
							const existing = await db
								.select()
								.from(strokes)
								.where(eq(strokes.id, message.data.id))
								.limit(1);

							if (existing.length > 0) {
								// 存在，标记为未删除
								await db
									.update(strokes)
									.set({ isDeleted: false })
									.where(eq(strokes.id, message.data.id));
							} else {
								// 不存在，插入新笔画
								await db.insert(strokes).values({
									id: message.data.id,
									userId: userId,
									roomId: roomId,
									data: message.data,
									isDeleted: false,
									createdAt: new Date(message.data.createdAt),
								});
							}

							// 广播重做消息
							ws.publish(roomId, {
								type: 'redo',
								data: message.data,
								userId,
								timestamp: Date.now(),
							});
						} else {
							// 旧逻辑：查找该用户已删除的笔画记录，按创建时间正序排序
							// 这样可以确保按笔画创建的顺序恢复，而不是按删除顺序
							const deletedStrokes = await db
								.select()
								.from(strokes)
								.where(
									and(
										eq(strokes.userId, userId),
										eq(strokes.roomId, roomId),
										eq(strokes.isDeleted, true)
									)
								)
								.orderBy(asc(strokes.createdAt));

							if (deletedStrokes.length > 0) {
								// 找到最早创建但被删除的笔画
								const strokeToRedo = deletedStrokes[0];
								if (!strokeToRedo) {
									// 没有可重做的笔画，发送空消息让客户端知道无操作
									ws.publish(roomId, {
										type: 'redo',
										data: null,
										userId,
										timestamp: Date.now(),
									});
									return;
								}
								const strokeId = strokeToRedo.id;
								console.log(`重做笔画: 用户 ${userId}, 笔画ID: ${strokeId}`);
								// 恢复已删除的笔画
								await db
									.update(strokes)
									.set({ isDeleted: false })
									.where(eq(strokes.id, strokeId));

								// 广播重做消息
								ws.publish(roomId, {
									type: 'redo',
									data: strokeToRedo.data,
									userId,
									timestamp: Date.now(),
								});
							} else {
								// 没有可重做的笔画，发送空消息让客户端知道无操作
								ws.publish(roomId, {
									type: 'redo',
									data: null,
									userId,
									timestamp: Date.now(),
								});
							}
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

export default boardRoute;
