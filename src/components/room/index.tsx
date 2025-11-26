import { useEffect, useState, useRef } from 'react';
import { roomApi, type Room } from '../../api/room';
import { useAuth } from '../../context/auth-context';

export function RoomPage() {
	const { user, logout } = useAuth();
	const [rooms, setRooms] = useState<Room[]>([]);
	const [loading, setLoading] = useState(true);
	const [newRoomName, setNewRoomName] = useState('');
	const [isCreating, setIsCreating] = useState(false);
	const [showUserMenu, setShowUserMenu] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	const fetchRooms = async () => {
		try {
			setLoading(true);
			const data = await roomApi.getRooms();
			setRooms(data);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchRooms();
	}, []);

	const handleCreateRoom = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newRoomName.trim()) return;

		try {
			setIsCreating(true);
			const { roomId } = await roomApi.createRoom(newRoomName);
			await fetchRooms();
			setNewRoomName('');
			window.location.href = `/room/${roomId}`;
		} finally {
			setIsCreating(false);
		}
	};

	const handleEnterRoom = (roomId: string) => {
		window.location.href = `/room/${roomId}`;
	};

	const handleDeleteRoom = async (e: React.MouseEvent, roomId: string) => {
		e.stopPropagation();

		if (roomId === 'default-room') {
			alert('默认房间不可删除');
			return;
		}

		if (!confirm('确定删除房间？')) return;

		await roomApi.deleteRoom(roomId);
		setRooms((prev) => prev.filter((r) => r.id !== roomId));
	};

	const handleLogout = async () => {
		await logout();
	};

	const renderRoomCreatedAt = (room: Room) => {
		if (room.id === 'default-room') {
			return <span className="text-xs text-zinc-500">默认房间</span>;
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
							<div>
								<h1 className="text-lg font-bold text-zinc-900">
									Infinite Board
								</h1>
								<p className="text-xs text-zinc-500">协作白板</p>
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
										{rooms.length}
									</span>
								</div>
							</div>
							<div className="rounded-lg bg-zinc-50 p-4">
								<div className="flex items-center justify-between">
									<span className="text-sm text-zinc-600">今日创作</span>
									<span className="text-lg font-bold text-zinc-900">0</span>
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
									<button className="flex w-full items-center gap-3 border-b border-zinc-100 px-4 py-3 text-left text-sm font-medium text-zinc-700 transition-colors duration-150 hover:bg-zinc-50">
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
									</button>
									<button
										onClick={handleLogout}
										className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-red-600 transition-colors duration-150 hover:bg-red-50"
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
									</button>
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
						<div className="flex gap-3">
							<input
								type="text"
								placeholder="输入房间名称..."
								value={newRoomName}
								onChange={(e) => setNewRoomName(e.target.value)}
								disabled={isCreating}
								className="flex-1 rounded-lg border border-zinc-300 px-4 py-2.5 text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/20 focus:outline-none disabled:bg-zinc-50 disabled:text-zinc-500"
								onKeyDown={(e) => {
									if (e.key === 'Enter') {
										handleCreateRoom(e);
									}
								}}
							/>
							<button
								type="button"
								onClick={handleCreateRoom}
								disabled={isCreating || !newRoomName.trim()}
								className="rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{isCreating ? '创建中...' : '创建房间'}
							</button>
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
										className="group cursor-pointer rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-zinc-400 hover:shadow-md"
									>
										<div className="mb-3 flex items-start justify-between">
											<div className="min-w-0 flex-1">
												<h4 className="truncate text-base font-semibold text-zinc-900 transition-colors group-hover:text-zinc-700">
													{room.name}
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
		</div>
	);
}
