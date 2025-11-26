import {
	sqliteTable,
	text,
	integer,
	uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	username: text('username').unique().notNull(),
	password: text('password').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(
		() => new Date()
	),
});

export const rooms = sqliteTable('rooms', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	ownerId: text('owner_id').notNull(),
	isPrivate: integer('is_private', { mode: 'boolean' }).default(false),
	password: text('password'),

	createdAt: integer('created_at', { mode: 'timestamp' }).default(
		sql`CURRENT_TIMESTAMP`
	),
});

export const strokes = sqliteTable('strokes', {
	id: text('id').primaryKey(),

	roomId: text('room_id')
		.notNull()
		.references(() => rooms.id, { onDelete: 'cascade' }),

	userId: text('user_id').notNull(),

	data: text('data', { mode: 'json' }).notNull(),

	isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(
		sql`CURRENT_TIMESTAMP`
	),
});

export const viewStates = sqliteTable(
	'view_states',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),

		userId: text('user_id').notNull(),
		roomId: text('room_id').notNull(),

		offsetX: integer('offset_x').notNull(),
		offsetY: integer('offset_y').notNull(),
		scale: integer('scale').notNull(), // 存储为整数，避免浮点精度问题

		updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(
			() => new Date()
		),
	},
	(table) => ({
		userRoomUnique: uniqueIndex('view_states_user_room_unique').on(
			table.userId,
			table.roomId
		),
	})
);

export const userStats = sqliteTable('user_stats', {
	id: integer('id').primaryKey({ autoIncrement: true }),

	userId: text('user_id').notNull().unique(),

	totalStrokes: integer('total_strokes').notNull().default(0),
	todayStrokes: integer('today_strokes').notNull().default(0),

	totalPixels: integer('total_pixels').notNull().default(0),
	todayPixels: integer('today_pixels').notNull().default(0),

	lastUpdated: integer('last_updated', { mode: 'timestamp' }).$defaultFn(
		() => new Date()
	),
});

export const roomsRelations = relations(rooms, ({ many }) => ({
	strokes: many(strokes),
}));

export const strokesRelations = relations(strokes, ({ one }) => ({
	room: one(rooms, {
		fields: [strokes.roomId],
		references: [rooms.id],
	}),
}));
