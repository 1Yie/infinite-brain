import { useState } from 'react';
import { useAuth } from '../../context/auth-context';
import { toast } from 'sonner';
import { Turnstile } from '@marsidev/react-turnstile';

export function Login() {
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [captchaToken, setCaptchaToken] = useState<string | null>(null);

	const { login } = useAuth();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!username.trim() || !password.trim()) {
			toast.error('请输入用户名和密码');
			return;
		}

		if (!captchaToken) {
			toast.error('请先完成人机验证');
			return;
		}

		setIsLoading(true);

		try {
			await login(username.trim(), password);
			toast.success('登录成功');
		} catch (error) {
			console.error('登录错误:', error);
			const errorMessage =
				error instanceof Error ? error.message : '登录失败，请稍后重试';
			toast.error(errorMessage);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen">
			{/* 左侧：笔记展示 */}
			<div className="hidden bg-zinc-50 lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:px-8 lg:py-12">
				<div className="relative mx-auto w-full max-w-md">
					{/* 模拟白板背景 */}
					<div className="relative rounded-2xl border border-zinc-200 bg-white p-12 shadow-sm">
						{/* 点状网格背景 */}
						<div
							className="absolute inset-0 rounded-2xl opacity-[0.15]"
							style={{
								backgroundImage:
									'radial-gradient(circle, #71717a 1px, transparent 1px)',
								backgroundSize: '24px 24px',
							}}
						></div>

						{/* 笔记内容 */}
						<div className="relative space-y-8">
							{/* 特性列表 */}
							<div className="space-y-6 pt-4">
								<div className="flex items-start gap-4">
									<div className="mt-1.5 flex-shrink-0">
										<div className="h-2 w-2 rounded-full bg-zinc-700"></div>
									</div>
									<div className="flex-1">
										<div className="mb-1 text-base font-semibold text-zinc-800">
											实时协作
										</div>
										<div className="h-px w-full bg-zinc-200"></div>
										<p className="mt-1 text-sm text-zinc-600">
											多人同时在线，笔画即时同步
										</p>
									</div>
								</div>

								<div className="flex items-start gap-4">
									<div className="mt-1.5 flex-shrink-0">
										<div className="h-2 w-2 rounded-full bg-zinc-700"></div>
									</div>
									<div className="flex-1">
										<div className="mb-1 text-base font-semibold text-zinc-800">
											矢量绘图
										</div>
										<div className="h-px w-full bg-zinc-200"></div>
										<p className="mt-1 text-sm text-zinc-600">
											高精度矢量图形，无限缩放不失真
										</p>
									</div>
								</div>

								<div className="flex items-start gap-4">
									<div className="mt-1.5 flex-shrink-0">
										<div className="h-2 w-2 rounded-full bg-zinc-700"></div>
									</div>
									<div className="flex-1">
										<div className="mb-1 text-base font-semibold text-zinc-800">
											无限画布
										</div>
										<div className="h-px w-full bg-zinc-200"></div>
										<p className="mt-1 text-sm text-zinc-600">
											没有边界限制，想画多大画多大
										</p>
									</div>
								</div>
							</div>

							{/* 装饰性手绘线条 */}
							<div className="pt-6">
								<svg width="100%" height="40" className="opacity-20">
									<path
										d="M20 20 Q100 15 180 20 Q260 25 340 20"
										stroke="#18181b"
										strokeWidth="2"
										fill="none"
										strokeLinecap="round"
										strokeDasharray="3,6"
									/>
								</svg>
							</div>
						</div>
					</div>

					{/* 底部提示文字 */}
					<p className="mt-6 text-center text-sm text-zinc-500">
						用画笔记录你的每一个想法
					</p>
				</div>
			</div>

			{/* 右侧：登录表单 */}
			<div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
				<div className="w-full max-w-md space-y-8">
					<div>
						<h2 className="mt-6 text-center text-3xl font-extrabold text-zinc-900">
							登录到 Infinite Brain
						</h2>
						<p className="mt-2 text-center text-sm text-zinc-600">
							还没有账号？
							<a
								href="/register"
								className="ml-1 font-medium text-zinc-900 hover:text-zinc-700"
							>
								立即注册
							</a>
						</p>
					</div>

					<div className="mt-8 space-y-6">
						<div className="space-y-4">
							<div>
								<label
									htmlFor="username"
									className="block text-sm font-medium text-zinc-700"
								>
									用户名
								</label>
								<input
									id="username"
									name="username"
									type="text"
									required
									className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-500 shadow-sm focus:border-zinc-900 focus:ring-zinc-900 focus:outline-none sm:text-sm"
									placeholder="请输入用户名"
									value={username}
									onChange={(e) => setUsername(e.target.value)}
									disabled={isLoading}
								/>
							</div>
							<div>
								<label
									htmlFor="password"
									className="block text-sm font-medium text-zinc-700"
								>
									密码
								</label>
								<input
									id="password"
									name="password"
									type="password"
									required
									className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-500 shadow-sm focus:border-zinc-900 focus:ring-zinc-900 focus:outline-none sm:text-sm"
									placeholder="请输入密码"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									disabled={isLoading}
								/>
							</div>
						</div>

						{/* Cloudflare Turnstile 验证码 */}
						<div className="overflow-hidden rounded-lg border border-zinc-300">
							<Turnstile
								className="cf-turnstile"
								siteKey={import.meta.env.VITE_SITE_KEY as string}
								onSuccess={setCaptchaToken}
								options={{ size: 'flexible' }}
								onError={() => setCaptchaToken(null)}
								onExpire={() => setCaptchaToken(null)}
							/>
						</div>

						<div>
							<button
								type="button"
								onClick={handleSubmit}
								disabled={isLoading}
								className="flex w-full justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
							>
								{isLoading ? '登录中...' : '登录'}
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
