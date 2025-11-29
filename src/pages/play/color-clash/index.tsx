import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import {
	AlertDialog,
	AlertDialogPopup,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { colorClashApi } from '@/api/color-clash';
import { SetTitle } from '@/utils/set-title';
import type { ColorClashRoom } from '@/api/color-clash';
import {
	ArrowLeft,
	Plus,
	Search,
	Users,
	Clock,
	Loader2,
	Gamepad2,
	Lock,
	ArrowRight,
	RefreshCw,
	User,
	Hash,
	LogIn,
} from 'lucide-react';

export function ColorClashRoom() {
	const navigate = useNavigate();
	const [rooms, setRooms] = useState<ColorClashRoom[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isJoining, setIsJoining] = useState(false);
	const [searchId, setSearchId] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [selectedRoom, setSelectedRoom] = useState<ColorClashRoom | null>(null);
	const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
	const [password, setPassword] = useState('');

	useEffect(() => {
		loadRooms();
	}, []);

	const loadRooms = async (showLoading = true) => {
		if (showLoading) {
			setIsLoading(true);
		}
		setError(null);
		try {
			const response = await colorClashApi.getRooms();
			if (response.success && response.data) {
				// 转换 createdAt 为 Date
				const roomsWithDate = response.data.map((room) => ({
					...room,
					createdAt: room.createdAt ? new Date(room.createdAt) : null,
				}));
				setRooms(roomsWithDate);
			} else {
				setError('获取房间列表失败');
			}
		} catch (error) {
			console.error('获取房间列表失败:', error);
			setError('获取房间列表失败');
		} finally {
			if (showLoading) {
				setIsLoading(false);
			}
		}
	};

	const handleJoinRoom = async (room: ColorClashRoom) => {
		if (room.isPrivate) {
			setSelectedRoom(room);
			setIsPasswordDialogOpen(true);
			return;
		}

		setIsJoining(true);
		setError(null);
		try {
			const response = await colorClashApi.joinRoom(room.id);

			if (response.success) {
				navigate(`/room/color-clash/${room.id}`);
			} else {
				setError(response.error?.message || '加入房间失败');
			}
		} catch (error) {
			console.error('加入房间失败:', error);
			setError('加入房间失败');
		} finally {
			setIsJoining(false);
		}
	};

	// 搜索 ID 直接加入
	const handleDirectJoin = async () => {
		if (!searchId.trim()) return;

		setIsJoining(true);
		setError(null);

		try {
			const response = await colorClashApi.joinRoom(searchId.trim());
			if (response.success) {
				navigate(`/room/color-clash/${searchId.trim()}`);
			} else {
				setError(response.error?.message || '加入房间失败：房间不存在或已满');
			}
		} catch (err) {
			setError('加入请求失败，请检查网络');
			console.error('System Error:', err);
		} finally {
			setIsJoining(false);
		}
	};

	const handleJoinWithPassword = async () => {
		if (!selectedRoom || !password.trim()) return;

		setIsJoining(true);
		setError(null);
		try {
			const response = await colorClashApi.joinRoom(
				selectedRoom.id,
				password.trim()
			);

			if (response.success) {
				navigate(`/room/color-clash/${selectedRoom.id}`);
			} else {
				setError(response.error?.message || '密码错误或加入房间失败');
			}
		} catch (error) {
			console.error('加入房间失败:', error);
			setError('加入房间失败');
		} finally {
			setIsJoining(false);
			setIsPasswordDialogOpen(false);
			setPassword('');
			setSelectedRoom(null);
		}
	};

	const handleCreateRoom = () => {
		navigate('/room/color-clash/create');
	};

	const formatGameTime = (seconds: number) => {
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}分${remainingSeconds}秒`;
	};

	const formatCanvasSize = (width: number, height: number) => {
		return `${width}×${height}`;
	};

	// 辅助函数：获取状态对应的样式
	const getStatusConfig = (status: string) => {
		switch (status) {
			case 'waiting':
				return {
					label: '等待加入',
					className: 'bg-green-50 text-green-700 border-green-200',
					icon: <Users className="mr-1 h-3 w-3" />,
				};
			case 'playing':
				return {
					label: '游戏中',
					className: 'bg-blue-50 text-blue-700 border-blue-200',
					icon: <Gamepad2 className="mr-1 h-3 w-3" />,
				};
			default:
				return {
					label: '已结束',
					className: 'bg-gray-100 text-gray-600 border-gray-200',
					icon: <Clock className="mr-1 h-3 w-3" />,
				};
		}
	};

	return (
		<div className="min-h-screen bg-gray-50">
			<SetTitle title="颜色对抗 - 游戏大厅" />

			{/* 密码输入弹窗 */}
			<AlertDialog
				open={isPasswordDialogOpen}
				onOpenChange={setIsPasswordDialogOpen}
			>
				<AlertDialogPopup>
					<AlertDialogHeader>
						<AlertDialogTitle>加入私密房间</AlertDialogTitle>
						<AlertDialogDescription>
							房间 ID #{selectedRoom?.id} 需要密码才能加入。
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div className="px-6 py-4">
						<Input
							type="password"
							placeholder="输入房间密码"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							onKeyDown={(e) => e.key === 'Enter' && handleJoinWithPassword()}
						/>
					</div>
					<AlertDialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsPasswordDialogOpen(false)}
						>
							取消
						</Button>
						<Button
							onClick={handleJoinWithPassword}
							disabled={!password.trim() || isJoining}
						>
							{isJoining ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									加入中
								</>
							) : (
								'加入房间'
							)}
						</Button>
					</AlertDialogFooter>
				</AlertDialogPopup>
			</AlertDialog>

			{/* 顶部导航栏 */}
			<header className="sticky top-0 z-10 border-b bg-white px-4 py-3 sm:px-6 lg:px-8">
				<div className="mx-auto flex max-w-7xl items-center justify-between">
					<div className="flex items-center gap-4">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => navigate('/room')}
							className="text-gray-600"
						>
							<ArrowLeft className="mr-1 h-4 w-4" /> 返回大厅
						</Button>
						<div className="flex items-center gap-2 border-l pl-4">
							<Gamepad2 className="h-5 w-5 text-gray-900" />
							<h1 className="text-lg font-bold text-gray-900">颜色对抗</h1>
						</div>
					</div>

					<div className="flex items-center gap-3">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => loadRooms()}
							disabled={isLoading}
							className="text-gray-600 hover:bg-gray-100"
						>
							<RefreshCw
								className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
							/>
							刷新
						</Button>
						<Button
							onClick={handleCreateRoom}
							size="sm"
							className="bg-black text-white hover:bg-gray-800"
						>
							<Plus className="mr-1 h-4 w-4" />
							创建房间
						</Button>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
				{/* 标题区与搜索栏 */}
				<div className="mb-8 flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h2 className="text-2xl font-bold text-gray-900">房间列表</h2>
						<div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
							<span>加入游戏或开启对局</span>
							<span className="text-gray-300">|</span>
							<span>
								在线:{' '}
								<span className="font-bold text-gray-900">{rooms.length}</span>
							</span>
						</div>
					</div>
					<div className="flex w-full max-w-sm items-center gap-2">
						<div className="relative flex-1">
							<Search className="pointer-events-none absolute top-1/2 left-3 z-5 h-4 w-4 -translate-y-1/2 text-gray-400" />

							<Input
								placeholder="输入房间 ID 加入..."
								className="bg-white pl-9"
								value={searchId}
								onChange={(e) => setSearchId(e.target.value)}
								onKeyDown={(e) => e.key === 'Enter' && handleDirectJoin()}
							/>
						</div>

						<Button
							variant="outline"
							onClick={handleDirectJoin}
							disabled={!searchId.trim() || isJoining}
							className="shrink-0"
						>
							{isJoining ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<>
									<LogIn className="mr-2 h-4 w-4" /> 加入
								</>
							)}
						</Button>
					</div>
				</div>

				{/* 错误提示 */}
				{error && (
					<Alert variant="error" className="mb-6">
						<p className="text-sm">{error}</p>
					</Alert>
				)}

				{/* 内容区 */}
				{isLoading && rooms.length === 0 ? (
					<div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50">
						<div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent"></div>
					</div>
				) : rooms.length === 0 ? (
					// 空状态
					<div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-20 text-center">
						<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
							<Search className="h-8 w-8 text-gray-500" />
						</div>
						<h3 className="text-lg font-medium text-gray-900">暂无房间</h3>
						<p className="mt-1 max-w-sm text-sm text-gray-500">
							目前还没有房间，你可以创建第一个，或者在上方输入 ID 加入指定房间。
						</p>
					</div>
				) : (
					// 房间网格 (原生 div 样式)
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{rooms.map((room) => {
							const statusConfig = getStatusConfig(room.status);
							const isFull = room.currentPlayers >= room.maxPlayers;

							return (
								<div
									key={room.id}
									className="group flex flex-col rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-gray-400 hover:shadow-sm"
								>
									{/* 头部：名称与状态 */}
									<div className="mb-4 flex items-start justify-between">
										<div className="min-w-0 pr-2">
											<div className="mb-1 flex items-center gap-1.5">
												<h3
													className="truncate font-bold text-gray-900"
													title={room.name}
												>
													{room.name}
												</h3>
												{room.isPrivate && (
													<Lock className="h-3 w-3 text-amber-500" />
												)}
											</div>
											<div className="flex items-center gap-1 font-mono text-xs text-gray-400">
												<Hash className="h-3 w-3" />
												{room.id}
											</div>
										</div>
										<Badge
											variant="outline"
											className={`shrink-0 border px-2 py-0.5 text-xs font-normal ${statusConfig.className}`}
										>
											{statusConfig.icon}
											{statusConfig.label}
										</Badge>
									</div>

									{/* 数据统计栏 */}
									<div className="mb-4 grid grid-cols-3 gap-2 border-y border-gray-100 py-3">
										<div className="flex flex-col items-center justify-center border-r border-gray-100 last:border-0">
											<span className="mb-0.5 flex items-center gap-1 text-xs text-gray-400">
												<Users className="h-3 w-3" />
												人数
											</span>
											<span className="font-mono text-sm font-bold text-gray-700">
												{room.currentPlayers}/{room.maxPlayers}
											</span>
										</div>
										<div className="flex flex-col items-center justify-center border-r border-gray-100 last:border-0">
											<span className="mb-0.5 flex items-center gap-1 text-xs text-gray-400">
												<Clock className="h-3 w-3" />
												时长
											</span>
											<span className="font-mono text-sm font-bold text-gray-700">
												{formatGameTime(room.gameTime)}
											</span>
										</div>
										<div className="flex flex-col items-center justify-center">
											<span className="mb-0.5 flex items-center gap-1 text-xs text-gray-400">
												<Gamepad2 className="h-3 w-3" />
												画布
											</span>
											<span className="font-mono text-sm font-bold text-gray-700">
												{formatCanvasSize(room.canvasWidth, room.canvasHeight)}
											</span>
										</div>
									</div>

									{/* 底部：房主与按钮 */}
									<div className="mt-auto flex items-center justify-between pt-1">
										<div className="flex items-center gap-2 overflow-hidden">
											<div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100">
												<User className="h-3.5 w-3.5 text-gray-500" />
											</div>
											<span className="truncate text-xs font-medium text-gray-600">
												{room.ownerName}
											</span>
										</div>

										<Button
											size="sm"
											onClick={() => handleJoinRoom(room)}
											disabled={
												isJoining || (room.status === 'playing' && isFull)
											}
											variant={
												room.status === 'playing' ? 'secondary' : 'default'
											}
											className={`h-8 px-4 text-xs font-medium ${
												room.status === 'playing'
													? 'bg-gray-100 text-gray-900 hover:bg-gray-200'
													: 'bg-black text-white hover:bg-gray-800'
											}`}
										>
											{isJoining ? (
												<>
													<Loader2 className="mr-1 h-3 w-3 animate-spin" />
													加入中
												</>
											) : room.status === 'playing' ? (
												'观战'
											) : (
												'加入'
											)}
											<ArrowRight className="ml-1 h-3 w-3" />
										</Button>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</main>
		</div>
	);
}
