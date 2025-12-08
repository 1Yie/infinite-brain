import { Elysia, t } from 'elysia';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { jwtAccess, auth, TIME_OUT } from '../utils/verify';

const SuccessResponse = t.Object({
	success: t.Boolean(),
	message: t.String(),
});

const ErrorResponse = t.Object({
	success: t.Boolean({ default: false }),
	message: t.String(),
});

const UserSchema = t.Object({
	id: t.Number(),
	name: t.String(),
});

type TurnstileVerifyResult = {
	success: boolean;
	'error-codes'?: string[];
};

export const authRoutes = new Elysia({ prefix: '/auth' })
	.use(jwtAccess)

	.post(
		'/register',
		async ({ body, set }) => {
			const secretKey = process.env.TURNSTILE_SECRET_KEY;
			const isDevelopment = process.env.NODE_ENV !== 'production';

			console.log(
				'环境变量 TURNSTILE_SECRET_KEY:',
				secretKey ? '已设置' : '未设置'
			);
			console.log('开发环境模式:', isDevelopment);

			if (!secretKey) {
				console.error('TURNSTILE_SECRET_KEY 环境变量未设置');
				set.status = 500;
				return { success: false, message: '服务器配置错误' };
			} else {
				console.log(
					'开始验证 Captcha Token:',
					body.captchaToken.substring(0, 20) + '...'
				);

				const verifyRes = await fetch(
					'https://challenges.cloudflare.com/turnstile/v0/siteverify',
					{
						headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
						method: 'POST',
						body: new URLSearchParams({
							secret: secretKey,
							response: body.captchaToken,
						}),
					}
				);

				const captchaResult = (await verifyRes.json()) as TurnstileVerifyResult;
				console.log('Captcha 验证结果:', captchaResult);

				if (!captchaResult.success) {
					console.warn('Turnstile 验证失败:', captchaResult);
					set.status = 400;
					return { success: false, message: '人机验证失败' };
				}
			}

			const hashedPassword = await Bun.password.hash(body.password);
			try {
				await db.insert(users).values({
					username: body.username,
					password: hashedPassword,
				});
				return { success: true, message: '注册成功' };
			} catch (e) {
				set.status = 400;
				console.warn(e);
				return { success: false, message: '用户名已存在' };
			}
		},
		{
			body: t.Object({
				username: t.String({ minLength: 3, description: '用户名' }),
				password: t.String({ minLength: 6, description: '密码' }),
				captchaToken: t.String({ description: '人机验证令牌' }),
			}),
			response: {
				200: SuccessResponse,
				400: ErrorResponse,
			},
			detail: {
				tags: ['Auth'],
				summary: '用户注册',
				description: '创建一个新的用户账户，用户名不可重复。',
			},
		}
	)

	.post(
		'/login',
		async ({ body, jwt, set, cookie }) => {
			const secretKey = process.env.TURNSTILE_SECRET_KEY;
			const isDevelopment = process.env.NODE_ENV !== 'production';

			console.log(
				'登录请求 - 环境变量 TURNSTILE_SECRET_KEY:',
				secretKey ? '已设置' : '未设置'
			);
			console.log('登录请求 - 开发环境模式:', isDevelopment);

			// 验证 CAPTCHA Token
			if (!secretKey) {
				console.error('TURNSTILE_SECRET_KEY 环境变量未设置');
				set.status = 500;
				return { success: false, message: '服务器配置错误' };
			} else {
				console.log(
					'开始验证登录 Captcha Token:',
					body.captchaToken.substring(0, 20) + '...'
				);

				const verifyRes = await fetch(
					'https://challenges.cloudflare.com/turnstile/v0/siteverify',
					{
						headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
						method: 'POST',
						body: new URLSearchParams({
							secret: secretKey,
							response: body.captchaToken,
						}),
					}
				);

				const captchaResult = (await verifyRes.json()) as TurnstileVerifyResult;
				console.log('登录 Captcha 验证结果:', captchaResult);

				if (!captchaResult.success) {
					console.warn('登录 Turnstile 验证失败:', captchaResult);
					set.status = 400;
					return { success: false, message: '人机验证失败' };
				}
			}

			// 验证用户名和密码
			const [user] = await db
				.select()
				.from(users)
				.where(eq(users.username, body.username));

			if (!user) {
				set.status = 401;
				return { success: false, message: '用户不存在' };
			}

			const isMatch = await Bun.password.verify(body.password, user.password);
			if (!isMatch) {
				set.status = 401;
				return { success: false, message: '密码错误' };
			}

			const token = await jwt.sign({
				id: user.id,
				name: user.username,
				exp: Math.floor(Date.now() / 1000) + TIME_OUT,
			});

			// 生产环境开启 httpOnly: true
			if (cookie.auth) {
				cookie.auth.set({
					value: token,
					httpOnly: true,
					maxAge: TIME_OUT,
					path: '/',
				});
			}

			return { success: true, user: { id: user.id, name: user.username } };
		},
		{
			body: t.Object({
				username: t.String({ default: 'admin' }),
				password: t.String({ default: '123456' }),
				captchaToken: t.String({ description: '人机验证令牌' }),
			}),
			response: {
				200: t.Object({
					success: t.Boolean(),
					user: UserSchema,
				}),
				401: ErrorResponse,
			},
			detail: {
				tags: ['Auth'],
				summary: '用户登录',
				description: '验证用户名密码，成功后设置 Cookie 并返回用户信息。',
			},
		}
	)

	.use(auth)
	.get(
		'/me',
		({ user }) => {
			return {
				success: true,
				user: {
					id: user.id,
					name: user.name,
					exp: user.exp,
				},
			};
		},
		{
			response: {
				200: t.Object({
					success: t.Boolean(),
					user: t.Object({
						id: t.Number(),
						name: t.String(),
						exp: t.Number(),
					}),
				}),
			},
			detail: {
				tags: ['Auth'],
				summary: '获取当前用户',
				description: '通过 Cookie 中的 Token 验证用户身份。',
			},
		}
	)

	.post(
		'/logout',
		async ({ cookie }) => {
			if (cookie.auth) {
				cookie.auth.set({
					value: '',
					httpOnly: false,
					maxAge: 0,
					path: '/',
				});
			}
			return { success: true, message: '登出成功' };
		},
		{
			response: {
				200: SuccessResponse,
			},
			detail: {
				tags: ['Auth'],
				summary: '退出登录',
				description: '清除用户 Cookie。',
			},
		}
	)

	.put(
		'/profile',
		async ({ body, user, set }) => {
			// 检查用户名是否已被其他用户使用
			if (body.username && body.username !== user.name) {
				const [existingUser] = await db
					.select()
					.from(users)
					.where(eq(users.username, body.username));

				if (existingUser) {
					set.status = 409;
					return { success: false, message: '用户名已被使用' };
				}
			}

			// 准备更新数据
			const updateData: Partial<typeof users.$inferInsert> = {};

			if (body.username) {
				updateData.username = body.username;
			}

			if (body.password) {
				updateData.password = await Bun.password.hash(body.password);
			}

			// 更新用户信息
			await db.update(users).set(updateData).where(eq(users.id, user.id));

			return {
				success: true,
				message: '资料更新成功',
				user: {
					id: user.id,
					name: body.username || user.name,
				},
			};
		},
		{
			body: t.Object({
				username: t.Optional(t.String()),
				password: t.Optional(t.String()),
			}),
			response: {
				200: t.Object({
					success: t.Boolean(),
					message: t.String(),
					user: UserSchema,
				}),
				409: ErrorResponse,
			},
			detail: {
				tags: ['Auth'],
				summary: '更新用户资料',
				description: '更新当前用户的用户名或密码。',
			},
		}
	);
