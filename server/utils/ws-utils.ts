import { db } from '../db';
import { strokes, userStats } from '../db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';

// 定义笔画数据类型
interface StrokeData {
	id: string;
	tool: 'pen' | 'eraser';
	color: string;
	size: number;
	points: { x: number; y: number }[];
	createdAt: Date | string;
	userId: string;
}

// 从数据库表推断选择类型
type StrokeSelect = typeof strokes.$inferSelect;

export async function handleStrokeFinish(
	userId: string,
	roomId: string,
	strokeData: StrokeData
): Promise<string> {
	const pixelCount = strokeData.points?.length || 0;

	// 保存笔画
	const strokeId = strokeData.id || crypto.randomUUID();
	await db.insert(strokes).values({
		id: strokeId,
		roomId,
		userId,
		data: strokeData,
		createdAt: strokeData.createdAt
			? new Date(strokeData.createdAt)
			: new Date(),
	});

	// 更新用户统计
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const existingStats = await db
		.select()
		.from(userStats)
		.where(eq(userStats.userId, userId))
		.limit(1);
	if (existingStats.length > 0) {
		const stats = existingStats[0]!;
		const lastUpdated = new Date(stats.lastUpdated || today);
		const now = new Date();
		const isSameDay =
			now.getFullYear() === lastUpdated.getFullYear() &&
			now.getMonth() === lastUpdated.getMonth() &&
			now.getDate() === lastUpdated.getDate();

		if (isSameDay) {
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
		await db.insert(userStats).values({
			userId,
			totalStrokes: 1,
			todayStrokes: 1,
			totalPixels: pixelCount,
			todayPixels: pixelCount,
			lastUpdated: new Date(),
		});
	}

	return strokeId;
}

export async function handleUndo(
	userId: string,
	roomId: string,
	strokeId?: string
): Promise<string | null> {
	let targetStrokeId = strokeId;

	if (!targetStrokeId) {
		// 查找用户最后一笔
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

		if (lastStroke.length > 0) targetStrokeId = lastStroke[0]!.id;
	} else {
		const strokeCheck = await db
			.select()
			.from(strokes)
			.where(
				and(
					eq(strokes.id, targetStrokeId),
					eq(strokes.roomId, roomId),
					eq(strokes.isDeleted, false)
				)
			)
			.limit(1);

		if (strokeCheck.length === 0 || strokeCheck[0]!.userId !== userId)
			return null;
	}

	if (targetStrokeId) {
		await db
			.update(strokes)
			.set({ isDeleted: true })
			.where(eq(strokes.id, targetStrokeId));
		return targetStrokeId;
	}

	return null;
}

export async function handleRedo(
	userId: string,
	roomId: string
): Promise<StrokeSelect | null> {
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

	if (deletedStrokes.length === 0) return null;

	const strokeToRedo = deletedStrokes[0];
	if (!strokeToRedo) return null;

	await db
		.update(strokes)
		.set({ isDeleted: false })
		.where(eq(strokes.id, strokeToRedo.id));
	return strokeToRedo;
}
