import { useNavigate } from 'react-router-dom';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LogOut, Settings, User } from 'lucide-react';
import { useAuth } from '../../context/auth-context';

export function RoomPage() {
	const navigate = useNavigate();
	const { user, logout } = useAuth();

	const handleSelectRoomType = (
		type: 'whiteboard' | 'guess-draw' | 'color-clash'
	) => {
		if (type === 'whiteboard') {
			navigate('/room/whiteboard');
		} else if (type === 'guess-draw') {
			navigate('/room/guess-draw');
		} else if (type === 'color-clash') {
			navigate('/room/color-clash');
		}
	};

	const handleLogout = async () => {
		await logout();
		navigate('/');
	};

	const handleSettings = () => {
		navigate('/settings');
	};

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900">
			{/* 顶部导航栏 */}
			<header className="sticky top-0 z-10 border-b bg-white px-4 py-3 sm:px-6 lg:px-8 dark:bg-gray-800">
				<div className="mx-auto flex max-w-7xl items-center justify-between">
					<div className="flex items-center gap-4">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => navigate('/')}
							className="text-gray-600 dark:text-gray-400"
						>
							<ArrowLeft className="mr-1 h-4 w-4" />
							返回首页
						</Button>
						<div className="flex items-center gap-2 border-l pl-4">
							<svg
								className="h-5 w-5 text-gray-900 dark:text-gray-100"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
								/>
							</svg>
							<h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
								房间选择
							</h1>
						</div>
					</div>
					<div className="flex items-center gap-3">
						{user && (
							<span className="flex items-center gap-2 rounded-lg bg-gray-100 px-2 py-1 text-sm text-gray-700 dark:text-gray-300">
								<User className="h-4 w-4" />
								{user.name}
							</span>
						)}

						<div className="flex items-center gap-1">
							<Button
								variant="ghost"
								size="sm"
								onClick={handleSettings}
								className="bg-gray-100 px-2 py-1 text-gray-600 hover:bg-gray-200 dark:text-gray-400"
							>
								<Settings className="h-4 w-4" />
							</Button>

							<Button
								variant="ghost"
								size="sm"
								onClick={handleLogout}
								className="bg-gray-100 px-2 py-1 text-red-400 hover:bg-gray-200 dark:text-gray-400"
							>
								<LogOut className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</div>
			</header>

			<div className="mx-auto max-w-4xl p-8">
				{/* 页面标题 */}
				<header className="mb-12 text-center">
					<h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
						选择房间类型
					</h1>
					<p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
						{user ? (
							<>欢迎回来，{user.name}！</>
						) : (
							<>请先登录以访问房间功能。</>
						)}
					</p>
				</header>

				{/* 房间类型选择 */}
				<div className="grid grid-cols-1 gap-8 md:grid-cols-2">
					{/* 白板房间 */}
					<Card className="cursor-pointer transition-all hover:border-gray-400 hover:shadow-lg">
						<CardHeader>
							<CardTitle className="flex items-center gap-3">
								<svg
									className="h-8 w-8 text-blue-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
									/>
								</svg>
								白板协作
							</CardTitle>
							<CardDescription>
								多人实时协作的白板，支持绘制、文本、形状等元素。
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
									<svg
										className="h-4 w-4"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M5 13l4 4L19 7"
										/>
									</svg>
									实时同步绘制
								</div>
								<div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
									<svg
										className="h-4 w-4"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M5 13l4 4L19 7"
										/>
									</svg>
									多用户协作
								</div>
								<div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
									<svg
										className="h-4 w-4"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M5 13l4 4L19 7"
										/>
									</svg>
									撤销/撤回功能
								</div>
								<Button
									onClick={() => handleSelectRoomType('whiteboard')}
									className="w-full"
									size="lg"
								>
									进入白板房间
								</Button>
							</div>
						</CardContent>
					</Card>

					{/* 猜画游戏 */}
					<Card className="cursor-pointer transition-all hover:border-gray-400 hover:shadow-lg">
						<CardHeader>
							<CardTitle className="flex items-center gap-3">
								<svg
									className="h-8 w-8 text-green-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
									/>
								</svg>
								当代“毕加索”
							</CardTitle>
							<CardDescription>
								有趣的猜画游戏，通过绘制和猜测来娱乐和交流。
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
									<svg
										className="h-4 w-4"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M5 13l4 4L19 7"
										/>
									</svg>
									趣味猜画模式
								</div>
								<div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
									<svg
										className="h-4 w-4"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M5 13l4 4L19 7"
										/>
									</svg>
									多人实时互动
								</div>
								<div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
									<svg
										className="h-4 w-4"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M5 13l4 4L19 7"
										/>
									</svg>
									计分排名系统
								</div>
								<Button
									onClick={() => handleSelectRoomType('guess-draw')}
									className="w-full"
									size="lg"
								>
									进入你画我猜
								</Button>
							</div>
						</CardContent>
					</Card>

					{/* 颜色对抗 */}
					<Card className="cursor-pointer transition-all hover:border-gray-400 hover:shadow-lg">
						<CardHeader>
							<CardTitle className="flex items-center gap-3">
								<svg
									className="h-8 w-8 text-purple-600"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									{/* 九个不同颜色的圆点 */}
									<circle cx="6" cy="6" r="1.5" fill="#FF6B6B" />
									<circle cx="12" cy="6" r="1.5" fill="#4ECDC4" />
									<circle cx="18" cy="6" r="1.5" fill="#45B7D1" />
									<circle cx="6" cy="12" r="1.5" fill="#FFA07A" />
									<circle cx="12" cy="12" r="1.5" fill="#98D8C8" />
									<circle cx="18" cy="12" r="1.5" fill="#F7DC6F" />
									<circle cx="6" cy="18" r="1.5" fill="#BB8FCE" />
									<circle cx="12" cy="18" r="1.5" fill="#85C1E9" />
									<circle cx="18" cy="18" r="1.5" fill="#F8C471" />
								</svg>
								发奋“涂”墙
							</CardTitle>
							<CardDescription>
								实时多人颜色占领游戏，抢占更多画布空间获胜。
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
									<svg
										className="h-4 w-4"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M5 13l4 4L19 7"
										/>
									</svg>
									实时颜色占领
								</div>
								<div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
									<svg
										className="h-4 w-4"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M5 13l4 4L19 7"
										/>
									</svg>
									多人在线对战
								</div>
								<div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
									<svg
										className="h-4 w-4"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M5 13l4 4L19 7"
										/>
									</svg>
									计分排名系统
								</div>
								<Button
									onClick={() => handleSelectRoomType('color-clash')}
									className="w-full"
									size="lg"
								>
									进入颜色对抗
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
