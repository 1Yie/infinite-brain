import { db } from './db';
import { users, strokes } from './db/schema';

async function migrate() {
	console.log('开始数据库迁移...');

	try {
		// 创建users表
		await db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

		// 创建rooms表
		await db.run(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        is_private INTEGER DEFAULT 0,
        password TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

		// 插入默认房间
		await db.run(`
      INSERT OR IGNORE INTO rooms (id, name, owner_id, is_private, password, created_at)
      VALUES ('default-room', '默认房间', 'system', 0, NULL, CURRENT_TIMESTAMP)
    `);

		// 创建strokes表
		await db.run(`
      CREATE TABLE IF NOT EXISTS strokes (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        data TEXT NOT NULL,
        is_deleted INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

		// 创建view_states表
		await db.run(`
      CREATE TABLE IF NOT EXISTS view_states (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        room_id TEXT NOT NULL,
        offset_x INTEGER NOT NULL,
        offset_y INTEGER NOT NULL,
        scale INTEGER NOT NULL,
        updated_at DATETIME
      )
    `);

		// 创建view_states表的唯一索引
		await db.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS view_states_user_room_unique ON view_states (user_id, room_id)
    `);

		// 创建user_stats表
		await db.run(`
      CREATE TABLE IF NOT EXISTS user_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL UNIQUE,
        total_strokes INTEGER NOT NULL DEFAULT 0,
        today_strokes INTEGER NOT NULL DEFAULT 0,
        total_pixels INTEGER NOT NULL DEFAULT 0,
        today_pixels INTEGER NOT NULL DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

		// 创建你猜我画游戏房间表
		await db.run(`
      CREATE TABLE IF NOT EXISTS guess_draw_rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        owner_name TEXT NOT NULL,
        max_players INTEGER NOT NULL DEFAULT 8,
        current_players INTEGER NOT NULL DEFAULT 0,
        total_rounds INTEGER NOT NULL DEFAULT 3,
        round_time_limit INTEGER NOT NULL DEFAULT 60,
        is_private INTEGER DEFAULT 0,
        password TEXT,
        status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting', 'playing', 'finished')),
        current_round INTEGER NOT NULL DEFAULT 0,
        current_drawer_id TEXT,
        current_word TEXT,
        word_hint TEXT,
        round_start_time DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

		// 创建你猜我画游戏玩家表
		await db.run(`
      CREATE TABLE IF NOT EXISTS guess_draw_players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        score INTEGER NOT NULL DEFAULT 0,
        has_guessed INTEGER DEFAULT 0,
        is_drawing INTEGER DEFAULT 0,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES guess_draw_rooms(id) ON DELETE CASCADE
      )
    `);

		// 创建你猜我画游戏已使用词语表
		await db.run(`
      CREATE TABLE IF NOT EXISTS guess_draw_used_words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL,
        word TEXT NOT NULL,
        used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES guess_draw_rooms(id) ON DELETE CASCADE
      )
    `);

		// 创建词库表
		await db.run(`
      CREATE TABLE IF NOT EXISTS guess_draw_words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL DEFAULT '通用',
        difficulty INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

		// 插入一些默认词语
		const defaultWords = [
			['苹果', '水果', 1],
			['香蕉', '水果', 1],
			['汽车', '交通工具', 1],
			['飞机', '交通工具', 2],
			['太阳', '自然', 1],
			['月亮', '自然', 1],
			['小狗', '动物', 1],
			['大象', '动物', 2],
			['房子', '建筑', 1],
			['学校', '建筑', 2],
			['电脑', '电子产品', 2],
			['手机', '电子产品', 2],
			['书本', '文具', 1],
			['钢笔', '文具', 1],
			['篮球', '运动', 2],
			['足球', '运动', 2],
			['钢琴', '乐器', 3],
			['吉他', '乐器', 2],
			['医生', '职业', 2],
			['老师', '职业', 2],
		];

		for (const [word, category, difficulty] of defaultWords) {
			await db.run(
				`
        INSERT OR IGNORE INTO guess_draw_words (word, category, difficulty)
        VALUES (?, ?, ?)
      `,
				[word, category, difficulty]
			);
		}

		// 创建颜色对抗游戏房间表
		await db.run(`
      CREATE TABLE IF NOT EXISTS color_clash_rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        owner_name TEXT NOT NULL,
        max_players INTEGER NOT NULL DEFAULT 8,
        game_time INTEGER NOT NULL DEFAULT 300,
        canvas_width INTEGER NOT NULL DEFAULT 800,
        canvas_height INTEGER NOT NULL DEFAULT 600,
        is_private INTEGER DEFAULT 0,
        password TEXT,
        status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting', 'playing', 'finished')),
        game_start_time DATETIME,
        game_end_time DATETIME,
        winner_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

		// 创建颜色对抗游戏玩家表
		await db.run(`
      CREATE TABLE IF NOT EXISTS color_clash_players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        color TEXT NOT NULL,
        score INTEGER NOT NULL DEFAULT 0,
        is_connected INTEGER DEFAULT 1,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES color_clash_rooms(id) ON DELETE CASCADE
      )
    `);

		console.log('✅ 数据库迁移完成');
	} catch (error) {
		console.error('❌ 数据库迁移失败:', error);
		process.exit(1);
	}
}

migrate();
