import { Elysia, t } from 'elysia';
import { db } from '../db';
import { strokes } from '../db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '../utils/verify';

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
		t.Literal('cursor'),
	]),
	data: t.Optional(
		t.Union([DrawDataSchema, StrokeFinishSchema, CursorDataSchema, t.Any()])
	),
});

const roomUsers = new Map<string, Set<string>>();

export const websocketRoutes = new Elysia({ prefix: '/ws' })
	.use(auth)
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
					.where(eq(strokes.roomId, roomId))
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
						await db.insert(strokes).values({
							id: strokeData.id || crypto.randomUUID(),
							roomId: roomId,
							userId: userId,
							data: strokeData,
						});
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
				// TODO: 这里可以增加 undo 的逻辑
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
