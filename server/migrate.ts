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

		console.log('✅ 数据库迁移完成');
	} catch (error) {
		console.error('❌ 数据库迁移失败:', error);
		process.exit(1);
	}
}

migrate();
