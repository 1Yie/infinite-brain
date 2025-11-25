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

		console.log('✅ 数据库迁移完成');
	} catch (error) {
		console.error('❌ 数据库迁移失败:', error);
		process.exit(1);
	}
}

migrate();
