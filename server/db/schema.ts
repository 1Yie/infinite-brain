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

// 你猜我画游戏房间表
export const guessDrawRooms = sqliteTable('guess_draw_rooms', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	ownerId: text('owner_id').notNull(),
	ownerName: text('owner_name').notNull(),
	maxPlayers: integer('max_players').notNull().default(8),
	currentPlayers: integer('current_players').notNull().default(0),
	totalRounds: integer('total_rounds').notNull().default(3),
	roundTimeLimit: integer('round_time_limit').notNull().default(60), // 秒
	isPrivate: integer('is_private', { mode: 'boolean' }).default(false),
	password: text('password'),
	status: text('status', { enum: ['waiting', 'playing', 'finished'] })
		.notNull()
		.default('waiting'),
	currentRound: integer('current_round').notNull().default(0),
	currentDrawerId: text('current_drawer_id'),
	currentWord: text('current_word'),
	wordHint: text('word_hint'),
	roundStartTime: integer('round_start_time', { mode: 'timestamp' }),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(
		sql`CURRENT_TIMESTAMP`
	),
});

// 你猜我画游戏玩家表
export const guessDrawPlayers = sqliteTable('guess_draw_players', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	roomId: text('room_id')
		.notNull()
		.references(() => guessDrawRooms.id, { onDelete: 'cascade' }),
	userId: text('user_id').notNull(),
	username: text('username').notNull(),
	score: integer('score').notNull().default(0),
	hasGuessed: integer('has_guessed', { mode: 'boolean' }).default(false),
	isDrawing: integer('is_drawing', { mode: 'boolean' }).default(false),
	joinedAt: integer('joined_at', { mode: 'timestamp' }).default(
		sql`CURRENT_TIMESTAMP`
	),
});

// 你猜我画游戏已使用词语表
export const guessDrawUsedWords = sqliteTable('guess_draw_used_words', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	roomId: text('room_id')
		.notNull()
		.references(() => guessDrawRooms.id, { onDelete: 'cascade' }),
	word: text('word').notNull(),
	usedAt: integer('used_at', { mode: 'timestamp' }).default(
		sql`CURRENT_TIMESTAMP`
	),
});

// 词库表
export const guessDrawWords = sqliteTable('guess_draw_words', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	word: text('word').notNull().unique(),
	category: text('category').notNull().default('通用'),
	difficulty: integer('difficulty').notNull().default(1), // 1-5难度等级
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

// 你猜我画游戏关系
export const guessDrawRoomsRelations = relations(
	guessDrawRooms,
	({ many }) => ({
		players: many(guessDrawPlayers),
		usedWords: many(guessDrawUsedWords),
	})
);

export const guessDrawPlayersRelations = relations(
	guessDrawPlayers,
	({ one }) => ({
		room: one(guessDrawRooms, {
			fields: [guessDrawPlayers.roomId],
			references: [guessDrawRooms.id],
		}),
	})
);

export const guessDrawUsedWordsRelations = relations(
	guessDrawUsedWords,
	({ one }) => ({
		room: one(guessDrawRooms, {
			fields: [guessDrawUsedWords.roomId],
			references: [guessDrawRooms.id],
		}),
	})
);

// 颜色对抗游戏房间表
export const colorClashRooms = sqliteTable('color_clash_rooms', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	ownerId: text('owner_id').notNull(),
	ownerName: text('owner_name').notNull(),
	maxPlayers: integer('max_players').notNull().default(8),
	gameTime: integer('game_time').notNull().default(300), // 游戏时长（秒）
	canvasWidth: integer('canvas_width').notNull().default(800),
	canvasHeight: integer('canvas_height').notNull().default(600),
	isPrivate: integer('is_private', { mode: 'boolean' }).default(false),
	password: text('password'),
	status: text('status', { enum: ['waiting', 'playing', 'finished'] })
		.notNull()
		.default('waiting'),
	gameStartTime: integer('game_start_time', { mode: 'timestamp' }),
	gameEndTime: integer('game_end_time', { mode: 'timestamp' }),
	winnerId: text('winner_id'),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(
		sql`CURRENT_TIMESTAMP`
	),
});

// 颜色对抗游戏玩家表
export const colorClashPlayers = sqliteTable('color_clash_players', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	roomId: text('room_id').notNull(),
	userId: text('user_id').notNull(),
	username: text('username').notNull(),
	color: text('color').notNull(), // RGB颜色字符串，如 "rgb(255,0,0)"
	score: integer('score').notNull().default(0), // 占领的像素数量
	isConnected: integer('is_connected', { mode: 'boolean' }).default(true),
	lastActivity: integer('last_activity', { mode: 'timestamp' }).$defaultFn(
		() => new Date()
	),
	createdAt: integer('created_at', { mode: 'timestamp' }).default(
		sql`CURRENT_TIMESTAMP`
	),
});

// 颜色对抗游戏房间关系
export const colorClashRoomsRelations = relations(
	colorClashRooms,
	({ many }) => ({
		players: many(colorClashPlayers),
	})
);

// 颜色对抗游戏玩家关系
export const colorClashPlayersRelations = relations(
	colorClashPlayers,
	({ one }) => ({
		room: one(colorClashRooms, {
			fields: [colorClashPlayers.roomId],
			references: [colorClashRooms.id],
		}),
	})
);
