import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import { toast } from 'sonner';

export function Login() {
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [isLoading, setIsLoading] = useState(false);

	const { login } = useAuth();
	const navigate = useNavigate();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!username.trim() || !password.trim()) {
			toast.error('请输入用户名和密码');
			return;
		}

		setIsLoading(true);

		try {
			const response = await login(username.trim(), password);

			if (response.data && 'user' in response.data) {
				toast.success('登录成功');
				navigate('/');
			} else if (response.error) {
				const error = response.error as { message?: string };
				toast.error(error.message || '登录失败');
			} else {
				toast.error('登录失败');
			}
		} catch (error) {
			console.error('登录错误:', error);
			toast.error('登录失败，请稍后重试');
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
			<div className="w-full max-w-md space-y-8">
				<div>
					<h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
						登录到白板
					</h2>
					<p className="mt-2 text-center text-sm text-gray-600">
						还没有账号？
						<Link
							to="/register"
							className="font-medium text-blue-600 hover:text-blue-500"
						>
							立即注册
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
								className="relative block w-full appearance-none rounded-none rounded-b-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-blue-500 focus:ring-blue-500 focus:outline-none sm:text-sm"
								placeholder="密码"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
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
							{isLoading ? '登录中...' : '登录'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
