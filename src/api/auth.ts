import { client } from './client';

export const authApi = {
	/**
	 * 用户注册
	 */
	register: (form: { username: string; password: string }) => {
		return client.api.auth.register.post(form);
	},

	/**
	 * 用户登录
	 */
	login: (form: { username: string; password: string }) => {
		return client.api.auth.login.post(form);
	},

	/**
	 * 检查登录状态
	 */
	checkAuth: async () => {
		const response = await client.api.auth.me.get();
		// 如果status是401，从error中提取消息
		if (response.status === 401 && response.error) {
			const err = response.error as { message?: string };
			return { success: false, message: err?.message || '认证失败' };
		}
		return response.data || { success: false };
	},

	/**
	 * 用户登出
	 */
	logout: async () => {
		const response = await client.api.auth.logout.post();
		return response.data || { success: false };
	},
};

// types
type MeResponse = Awaited<ReturnType<typeof client.api.auth.me.get>>;
type MeData = NonNullable<MeResponse['data']>;
export type User = MeData extends { user: infer U } ? U : never;

export type CheckAuthResponse = Awaited<ReturnType<typeof authApi.checkAuth>>;
export type LoginResponse = Awaited<ReturnType<typeof authApi.login>>;
export type LogoutResponse = Awaited<ReturnType<typeof authApi.logout>>;
