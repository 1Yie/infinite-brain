import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
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

export const roomsRelations = relations(rooms, ({ many }) => ({
	strokes: many(strokes),
}));

export const strokesRelations = relations(strokes, ({ one }) => ({
	room: one(rooms, {
		fields: [strokes.roomId],
		references: [rooms.id],
	}),
}));
