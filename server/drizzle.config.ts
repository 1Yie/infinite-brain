import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './db/schema.ts',

	out: './drizzle',

	// 数据库类型
	dialect: 'sqlite',

	// 数据库连接配置
	dbCredentials: {
		url: 'sqlite.db',
	},
});
