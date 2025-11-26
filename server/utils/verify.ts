import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';

export const TIME_OUT = 7 * 24 * 60 * 60; // 7天
export const JWT_SECRET =
	process.env.JWT_SECRET_KEY || 'jTsW4gYMVLwITB320UYYOhV3Eo6LQHmFewnOdDIblMH';

export interface JwtPayload {
	id: number;
	name: string;
	exp: number;
}

export const jwtAccess = (app: Elysia) =>
	app.use(
		jwt({
			name: 'jwt',
			secret: JWT_SECRET,
		})
	);

export const auth = (app: Elysia) =>
	app.use(jwtAccess).derive(async ({ jwt, cookie }) => {
		const token = cookie.auth?.value;

		if (!token) throw new Error('未登录');

		const rawPayload = await jwt.verify(token as string);
		if (!rawPayload) throw new Error('Token 无效');

		const payload = rawPayload as unknown as JwtPayload;

		if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
			throw new Error('Token 已过期');
		}

		return {
			user: {
				...payload,
				id: payload.id,
			},
		};
	});

export const optionalAuth = (app: Elysia) =>
	app.use(jwtAccess).derive(async ({ jwt, cookie }) => {
		const token = cookie.auth?.value;

		// 如果没有 token，返回游客用户
		if (!token) {
			return {
				user: {
					id: `guest-${crypto.randomUUID()}`,
					name: 'Guest',
				},
			};
		}

		const rawPayload = await jwt.verify(token as string);
		if (!rawPayload) {
			// token 无效，返回游客用户
			return {
				user: {
					id: `guest-${crypto.randomUUID()}`,
					name: 'Guest',
				},
			};
		}

		const payload = rawPayload as unknown as JwtPayload;

		if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
			// Token 已过期，返回游客用户
			return {
				user: {
					id: `guest-${crypto.randomUUID()}`,
					name: 'Guest',
				},
			};
		}

		return {
			user: {
				...payload,
				id: payload.id,
			},
		};
	});
