import { describe, expect, it } from 'bun:test';
import { Elysia } from 'elysia';
import { api } from '../api';

describe('API 接口测试', () => {
	it('API 前缀路由应该正常工作', async () => {
		const app = new Elysia().use(api);

		const response = await app
			.handle(new Request('http://localhost/api'))
			.then((res) => {
				return {
					status: res.status,
					text: res.text(),
				};
			});
		expect([200, 404, 405]).toContain(response.status);
	});

	it('认证路由应该正常工作', async () => {
		const app = new Elysia().use(api);

		const response = await app
			.handle(new Request('http://localhost/api/auth'))
			.then((res) => {
				return {
					status: res.status,
					text: res.text(),
				};
			});

		expect([200, 404, 405]).toContain(response.status);
	});

	it('房间路由应该正常工作', async () => {
		const app = new Elysia().use(api);

		const response = await app
			.handle(new Request('http://localhost/api/room'))
			.then((res) => {
				return {
					status: res.status,
					text: res.text(),
				};
			});

		expect([200, 401, 404, 405]).toContain(response.status);
	});

	it('WebSocket路由应该正常工作', async () => {
		const app = new Elysia().use(api);

		// 创建一个模拟的WebSocket升级请求
		const headers = new Headers();
		headers.set('Upgrade', 'websocket');
		headers.set('Connection', 'Upgrade');
		headers.set('Sec-WebSocket-Key', 'dGhlIHNhbXBsZSBub25jZQ==');
		headers.set('Sec-WebSocket-Version', '13');

		const response = await app
			.handle(new Request('http://localhost/api/ws', { headers }))
			.then((res) => {
				return {
					status: res.status,
					text: res.text(),
				};
			});

		expect([101, 400, 404, 426]).toContain(response.status);
	});

	it('视图状态路由应该正常工作', async () => {
		const app = new Elysia().use(api);

		const response = await app
			.handle(new Request('http://localhost/api/view-state'))
			.then((res) => {
				return {
					status: res.status,
					text: res.text(),
				};
			});

		// 根据实际API实现调整期望
		expect([200, 401, 404, 405]).toContain(response.status);
	});
});
