import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { toast } from 'sonner';

export function Register() {
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [isLoading, setIsLoading] = useState(false);

	const navigate = useNavigate();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!username.trim() || !password.trim()) {
			toast.error('请输入用户名和密码');
			return;
		}

		if (password !== confirmPassword) {
			toast.error('两次输入的密码不一致');
			return;
		}

		if (password.length < 6) {
			toast.error('密码长度至少6位');
			return;
		}

		setIsLoading(true);

		try {
			const response = await authApi.register({
				username: username.trim(),
				password,
			});

			if (
				response.data &&
				'success' in response.data &&
				response.data.success
			) {
				toast.success('注册成功，请登录');
				navigate('/login');
			} else if (response.error) {
				const error = response.error as { message?: string };
				toast.error(error.message || '注册失败');
			} else {
				toast.error('注册失败');
			}
		} catch (error) {
			console.error('注册错误:', error);
			toast.error('注册失败，请稍后重试');
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
			<div className="w-full max-w-md space-y-8">
				<div>
					<h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
						注册新账号
					</h2>
					<p className="mt-2 text-center text-sm text-gray-600">
						已有账号？
						<Link
							to="/login"
							className="font-medium text-blue-600 hover:text-blue-500"
						>
							立即登录
						</Link>
					</p>
				</div>

				<form className="mt-8 space-y-6" onSubmit={handleSubmit}>
					<div className="-space-y-px rounded-md shadow-sm">
						<div>
							<label htmlFor="username" className="sr-only">
								用户名
							</label>
							<input
								id="username"
								name="username"
								type="text"
								required
								className="relative block w-full appearance-none rounded-none rounded-t-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
								placeholder="用户名"
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								disabled={isLoading}
							/>
						</div>
						<div>
							<label htmlFor="password" className="sr-only">
								密码
							</label>
							<input
								id="password"
								name="password"
								type="password"
								required
								className="relative block w-full appearance-none rounded-none border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
								placeholder="密码（至少6位）"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								disabled={isLoading}
							/>
						</div>
						<div>
							<label htmlFor="confirmPassword" className="sr-only">
								确认密码
							</label>
							<input
								id="confirmPassword"
								name="confirmPassword"
								type="password"
								required
								className="relative block w-full appearance-none rounded-none rounded-b-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
								placeholder="确认密码"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								disabled={isLoading}
							/>
						</div>
					</div>

					<div>
						<button
							type="submit"
							disabled={isLoading}
							className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
						>
							{isLoading ? '注册中...' : '注册'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
