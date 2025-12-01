import { Elysia, t } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { cors } from '@elysiajs/cors';
import { api } from './api';
import 'dotenv/config';
import { db } from './db';
import { boardRooms } from './db/schema';

const port = process.env.PORT || 3000;

// 确保默认房间存在
await db
	.insert(boardRooms)
	.values({
		id: 'default-room',
		name: '默认房间',
		ownerId: 'system',
	})
	.onConflictDoNothing();

const app = new Elysia()
	.use(
		cors({
			// origin: ['https://infinite.ichiyo.in', 'https://infinite.server.ichiyo.in'],
			origin: ['http://localhost:5173', 'http://localhost:3000'],
			credentials: true,
		})
	)
	.use(
		swagger({
			documentation: {
				info: {
					title: '画板 API',
					description: '画板系统的后端 API 文档',
					version: '1.0.0',
				},
			},
		})
	)

	.onRequest(({ request }) => {
		console.log(`${request.method} ${request.url}`);
	})

	.use(api)

	.get('/', () => 'Hello Elysia Server!', {
		detail: {
			tags: ['General'],
			summary: '健康检查 / 欢迎页',
			description: '用于检测服务器是否启动成功的根路径。',
		},
		response: {
			200: t.String({
				description: '服务器返回的欢迎文本',
				example: 'Hello Elysia Server!',
			}),
		},
	})

	.listen(port);

console.log(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

export type App = typeof app;
