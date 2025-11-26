import { useEffect, useState, useRef, useCallback } from 'react';
import { roomApi, type Room } from '../../api/room';
import { useAuth } from '../../context/auth-context';
import {
	AlertDialog,
	AlertDialogClose,
	AlertDialogDescription,
	AlertDialogPopup,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

export function RoomPage() {
	const { user, logout } = useAuth();
	const [rooms, setRooms] = useState<Room[]>([]);
	const [loading, setLoading] = useState(true);
	const [newRoomName, setNewRoomName] = useState('');
	const [isPrivateRoom, setIsPrivateRoom] = useState(false);
	const [roomPassword, setRoomPassword] = useState('');
	const [isCreating, setIsCreating] = useState(false);
	const [showUserMenu, setShowUserMenu] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const [alertMessage, setAlertMessage] = useState('');
	const [isAlertOpen, setIsAlertOpen] = useState(false);
	const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
	const [roomToDelete, setRoomToDelete] = useState<string | null>(null);
	const [roomNameToDelete, setRoomNameToDelete] = useState<string>('');
	const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
	const [joinRoomId, setJoinRoomId] = useState<string>('');
	const [joinPassword, setJoinPassword] = useState('');
	const [userStats, setUserStats] = useState({
		totalStrokes: 0,
		todayStrokes: 0,
		totalPixels: 0,
		todayPixels: 0,
	});

	const fetchStats = useCallback(async () => {
		try {
			const stats = await roomApi.getUserStats();
			setUserStats(stats);
		} catch (error) {
			console.warn('获取统计数据失败:', error);
		}
	}, []);

	const fetchRooms = useCallback(async () => {
		try {
			setLoading(true);
			const data = await roomApi.getRooms();
			setRooms(data);

			// 获取用户统计数据
			await fetchStats();
		} finally {
			setLoading(false);
		}
	}, [fetchStats]);

	useEffect(() => {
		fetchRooms();
	}, []);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setShowUserMenu(false);
			}
		};

		if (showUserMenu) {
			document.addEventListener('mousedown', handleClickOutside);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [showUserMenu]);

	const handleCreateRoom = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newRoomName.trim()) return;

		if (isPrivateRoom && !roomPassword.trim()) {
			setAlertMessage('请输入房间密码');
			setIsAlertOpen(true);
			return;
		}

		try {
			setIsCreating(true);
			const { roomId } = await roomApi.createRoom(
				newRoomName,
				isPrivateRoom,
				isPrivateRoom ? roomPassword : undefined
			);
			await fetchRooms();
			setNewRoomName('');
			setIsPrivateRoom(false);
			setRoomPassword('');
			window.location.href = `/room/${roomId}`;
		} finally {
			setIsCreating(false);
		}
	};

	const handleEnterRoom = (roomId: string) => {
		const room = rooms.find((r) => r.id === roomId);
		if (room?.isPrivate) {
			setJoinRoomId(roomId);
			setIsJoinDialogOpen(true);
		} else {
			window.location.href = `/room/${roomId}`;
		}
	};

	const handleJoinRoom = async () => {
		try {
			await roomApi.joinRoom(joinRoomId, joinPassword);
			sessionStorage.setItem(`room_auth_${joinRoomId}`, 'true');
			setIsJoinDialogOpen(false);
			setJoinPassword('');
			window.location.href = `/room/${joinRoomId}`;
		} catch (error) {
			setAlertMessage(error instanceof Error ? error.message : '加入房间失败');
			setIsAlertOpen(true);
		}
	};

	const handleDeleteRoom = async (e: React.MouseEvent, roomId: string) => {
		e.stopPropagation();

		if (roomId === 'default-room') {
			setAlertMessage('默认房间不可删除');
			setIsAlertOpen(true);
			return;
		}

		setRoomToDelete(roomId);
		setRoomNameToDelete(rooms.find((r) => r.id === roomId)?.name || '');
		setIsConfirmDeleteOpen(true);
	};

	const handleLogout = async () => {
		await logout();
	};

	const confirmDeleteRoom = async () => {
		if (roomToDelete) {
			await roomApi.deleteRoom(roomToDelete);
			setRooms((prev) => prev.filter((r) => r.id !== roomToDelete));
			setRoomToDelete(null);
		}
		setIsConfirmDeleteOpen(false);
	};

	const renderRoomCreatedAt = (room: Room) => {
		if (room.id === 'default-room') {
			return <span className="text-xs text-zinc-500">系统默认</span>;
		}

		return new Date(room.createdAt!).toLocaleDateString('zh-CN', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		});
	};

	return (
		<div className="flex min-h-screen bg-zinc-50">
			{/* 左侧边栏 */}
			<aside className="w-64 border-r border-zinc-200 bg-white">
				<div className="flex h-full flex-col">
					{/* Logo 区域 */}
					<div className="border-b border-zinc-200 p-6">
						<div className="flex items-center gap-3">
							<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900">
								<svg
									className="h-6 w-6 text-white"
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
							</div>
							<div
								onClick={() => (window.location.href = '/')}
								className="cursor-pointer"
							>
								<h1 className="text-lg font-bold text-zinc-900">
									Infinite Board
								</h1>
								<p className="text-xs tracking-widest text-zinc-500">
									无限画布
								</p>
							</div>
						</div>
					</div>

					{/* 统计信息 */}
					<div className="flex-1 p-6">
						<div className="space-y-4">
							<div className="rounded-lg bg-zinc-50 p-4">
								<div className="flex items-center justify-between">
									<span className="text-sm text-zinc-600">我的房间</span>
									<span className="text-lg font-bold text-zinc-900">
										{rooms.filter((room) => room.id !== 'default-room').length}
									</span>
								</div>
							</div>
							<div className="rounded-lg bg-zinc-50 p-4">
								<div className="flex items-center justify-between">
									<span className="text-sm text-zinc-600">今日笔画</span>
									<span className="text-lg font-bold text-zinc-900">
										{userStats.todayStrokes}
									</span>
								</div>
							</div>
							<div className="rounded-lg bg-zinc-50 p-4">
								<div className="flex items-center justify-between">
									<span className="text-sm text-zinc-600">总共笔画</span>
									<span className="text-lg font-bold text-zinc-900">
										{userStats.totalStrokes}
									</span>
								</div>
							</div>
							<div className="rounded-lg bg-zinc-50 p-4">
								<div className="flex items-center justify-between">
									<span className="text-sm text-zinc-600">总共像素</span>
									<span className="text-lg font-bold text-zinc-900">
										{userStats.totalPixels.toLocaleString()}
									</span>
								</div>
							</div>
						</div>
					</div>

					{/* 用户信息 */}
					{user && (
						<div className="border-t border-zinc-200">
							<div className="relative" ref={menuRef}>
								<button
									onClick={() => setShowUserMenu(!showUserMenu)}
									className="flex w-full items-center justify-between p-2 transition-colors duration-200 hover:bg-zinc-50"
								>
									<div className="flex items-center gap-3">
										<div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-blue-600 text-sm font-semibold text-white">
											{user?.name.charAt(0).toUpperCase()}
										</div>
										<div className="text-left">
											<div className="text-sm font-semibold text-zinc-800">
												{user?.name}
											</div>
										</div>
									</div>
									<svg
										className={`h-5 w-5 text-zinc-400 transition-transform duration-200 ${
											showUserMenu ? 'rotate-180' : ''
										}`}
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M19 9l-7 7-7-7"
										/>
									</svg>
								</button>

								{/* 下拉菜单 */}
								<div
									className={`absolute right-3 bottom-full left-3 mb-2 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg transition-all duration-200 ease-out ${
										showUserMenu
											? 'translate-y-0 scale-100 opacity-100'
											: 'pointer-events-none translate-y-2 scale-95 opacity-0'
									}`}
								>
									<Button
										variant="ghost"
										className="w-full justify-start rounded-none border-b border-zinc-100 py-3"
									>
										<svg
											className="h-4 w-4 text-zinc-500"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
											/>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
											/>
										</svg>
										设定
									</Button>
									<Button
										onClick={handleLogout}
										variant="ghost"
										className="w-full justify-start rounded-none py-3 text-red-600 hover:bg-red-50"
									>
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
												d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
											/>
										</svg>
										退出登录
									</Button>
								</div>
							</div>
						</div>
					)}
				</div>
			</aside>

			{/* 主内容区 */}
			<main className="flex-1 overflow-auto">
				<div className="mx-auto max-w-6xl p-8">
					{/* 页面标题 */}
					<header className="mb-8">
						<h2 className="text-2xl font-bold text-zinc-900">房间大厅</h2>
						<p className="mt-1 text-sm text-zinc-600">
							创建或加入房间，开始协作
						</p>
					</header>

					{/* 创建房间 */}
					<div className="mb-8 rounded-xl border border-zinc-200 bg-white p-6">
						<h3 className="mb-4 text-lg font-semibold text-zinc-900">
							新建房间
						</h3>
						<div className="space-y-4">
							<Input
								type="text"
								placeholder="输入房间名称..."
								value={newRoomName}
								onChange={(e) => setNewRoomName(e.target.value)}
								disabled={isCreating}
								onKeyDown={(e) => {
									if (e.key === 'Enter' && !isPrivateRoom) {
										handleCreateRoom(e);
									}
								}}
							/>
							<div className="flex items-center space-x-2">
								<Checkbox
									id="private-room"
									checked={isPrivateRoom}
									onCheckedChange={(checked) =>
										setIsPrivateRoom(checked as boolean)
									}
								/>
								<label
									htmlFor="private-room"
									className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
								>
									私密房间
								</label>
							</div>
							{isPrivateRoom && (
								<Input
									type="password"
									placeholder="输入房间密码..."
									value={roomPassword}
									onChange={(e) => setRoomPassword(e.target.value)}
									disabled={isCreating}
									onKeyDown={(e) => {
										if (e.key === 'Enter') {
											handleCreateRoom(e);
										}
									}}
								/>
							)}
							<Button
								type="button"
								onClick={handleCreateRoom}
								disabled={
									isCreating ||
									!newRoomName.trim() ||
									(isPrivateRoom && !roomPassword.trim())
								}
								className="w-full"
							>
								{isCreating ? '创建中...' : '创建房间'}
							</Button>
						</div>
					</div>

					{/* 房间列表 */}
					<div>
						<div className="mb-4 flex items-center justify-between">
							<h3 className="text-lg font-semibold text-zinc-900">
								房间列表
								{!loading && (
									<span className="ml-2 text-sm font-normal text-zinc-500">
										({rooms.length} 个房间)
									</span>
								)}
							</h3>
						</div>

						{loading ? (
							<div className="flex items-center justify-center rounded-xl border border-zinc-200 bg-white py-16">
								<div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent"></div>
							</div>
						) : rooms.length === 0 ? (
							<div className="rounded-xl border border-zinc-200 bg-white py-16 text-center">
								<svg
									className="mx-auto mb-4 h-16 w-16 text-zinc-300"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={1.5}
										d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
									/>
								</svg>
								<p className="text-sm font-medium text-zinc-900">暂无房间</p>
								<p className="mt-1 text-xs text-zinc-500">
									创建一个新房间开始协作吧
								</p>
							</div>
						) : (
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
								{rooms.map((room) => (
									<div
										key={room.id}
										onClick={() => handleEnterRoom(room.id)}
										className={`group cursor-pointer rounded-xl border bg-white p-5 transition-all hover:border-zinc-400 hover:shadow-md ${
											room.id === 'default-room'
												? 'border-zinc-300 bg-zinc-50/50'
												: 'border-zinc-200'
										}`}
									>
										<div className="mb-3 flex items-start justify-between">
											<div className="min-w-0 flex-1">
												<h4 className="flex items-center gap-2 truncate text-base font-semibold text-zinc-900 transition-colors group-hover:text-zinc-700">
													{room.name}
													{room.isPrivate && (
														<svg
															className="h-4 w-4 shrink-0 text-zinc-500"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24"
														>
															<path
																strokeLinecap="round"
																strokeLinejoin="round"
																strokeWidth={2}
																d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
															/>
														</svg>
													)}
													{room.id === 'default-room' && (
														<span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
															默认
														</span>
													)}
												</h4>
												<p className="mt-1.5 flex items-center gap-1.5 text-xs text-zinc-500">
													<svg
														className="h-3.5 w-3.5"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														{room.id === 'default-room' ? (
															<path
																d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a6 6 0 110 12 6 6 0 010-12z"
																fill="currentColor"
															/>
														) : (
															<path
																strokeLinecap="round"
																strokeLinejoin="round"
																strokeWidth={2}
																d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
															/>
														)}
													</svg>
													{renderRoomCreatedAt(room)}
												</p>
											</div>
											{room.id !== 'default-room' && (
												<button
													onClick={(e) => handleDeleteRoom(e, room.id)}
													className="rounded p-1.5 text-zinc-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
													title="删除房间"
												>
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
															d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
														/>
													</svg>
												</button>
											)}
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</main>

			{/* Alert Dialog for default room */}
			<AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
				<AlertDialogPopup>
					<AlertDialogHeader>
						<AlertDialogTitle>提示</AlertDialogTitle>
						<AlertDialogDescription>{alertMessage}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogClose>
							<Button>确定</Button>
						</AlertDialogClose>
					</AlertDialogFooter>
				</AlertDialogPopup>
			</AlertDialog>

			{/* Confirm Delete Dialog */}
			<AlertDialog
				open={isConfirmDeleteOpen}
				onOpenChange={setIsConfirmDeleteOpen}
			>
				<AlertDialogPopup>
					<AlertDialogHeader>
						<AlertDialogTitle>确认删除</AlertDialogTitle>
						<AlertDialogDescription>
							确认删除 {roomNameToDelete} ？
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogClose>
							<Button variant="outline">取消</Button>
						</AlertDialogClose>
						<Button
							onClick={confirmDeleteRoom}
							variant="destructive"
							className="ml-2"
						>
							确定
						</Button>
					</AlertDialogFooter>
				</AlertDialogPopup>
			</AlertDialog>

			{/* Join Room Dialog */}
			<AlertDialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
				<AlertDialogPopup>
					<AlertDialogHeader>
						<AlertDialogTitle>加入私密房间</AlertDialogTitle>
						<AlertDialogDescription>请输入房间密码</AlertDialogDescription>
					</AlertDialogHeader>
					<div className="px-6 py-4">
						<Input
							type="password"
							placeholder="输入密码..."
							value={joinPassword}
							onChange={(e) => setJoinPassword(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									handleJoinRoom();
								}
							}}
						/>
					</div>
					<AlertDialogFooter>
						<AlertDialogClose>
							<Button variant="outline">取消</Button>
						</AlertDialogClose>
						<Button onClick={handleJoinRoom} className="ml-2">
							加入房间
						</Button>
					</AlertDialogFooter>
				</AlertDialogPopup>
			</AlertDialog>
		</div>
	);
}
