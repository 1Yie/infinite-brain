import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomApi, type Room } from '../../api/room';
import { useAuth } from '../../context/auth-context';

export function RoomPage() {
	const navigate = useNavigate();
	const { logout } = useAuth();
	const [rooms, setRooms] = useState<Room[]>([]);
	const [loading, setLoading] = useState(true);
	const [newRoomName, setNewRoomName] = useState('');
	const [isCreating, setIsCreating] = useState(false);

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
			navigate(`/board/${roomId}`);
		} finally {
			setIsCreating(false);
			setNewRoomName('');
		}
	};

	const handleEnterRoom = (roomId: string) => {
		navigate(`/board/${roomId}`);
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

	const renderRoomCreatedAt = (room: Room) => {
		if (room.id === 'default-room') {
			return <span className="text-xs text-gray-500">默认房间</span>;
		}

		return new Date(room.createdAt!).toLocaleDateString('zh-CN', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		});
	};

	const handleLogout = async () => {
		await logout();
	};

	return (
		<div className="min-h-screen bg-gray-50">
			<div className="mx-auto max-w-6xl px-6 py-8">
				{/* 顶部 */}
				<header className="mb-10 flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold text-gray-900">协作白板</h1>
						<p className="mt-1 text-sm text-gray-500">实时协作，共同创作</p>
					</div>
					<button
						onClick={handleLogout}
						className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-50"
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
				</header>

				{/* 创建房间 */}
				<div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
					<div className="mb-4 flex items-center gap-2">
						<h3 className="text-lg font-semibold text-gray-900">新建房间</h3>
					</div>
					<form onSubmit={handleCreateRoom} className="flex gap-3">
						<input
							type="text"
							placeholder="输入房间名称..."
							value={newRoomName}
							onChange={(e) => setNewRoomName(e.target.value)}
							disabled={isCreating}
							className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
						/>
						<button
							type="submit"
							disabled={isCreating || !newRoomName.trim()}
							className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{isCreating ? '创建中...' : '创建房间'}
						</button>
					</form>
				</div>

				{/* 房间列表 */}
				<div>
					<div className="mb-4 flex items-center justify-between">
						<h3 className="text-lg font-semibold text-gray-900">
							房间列表
							{!loading && (
								<span className="ml-2 text-sm font-normal text-gray-500">
									({rooms.length} 个房间)
								</span>
							)}
						</h3>
					</div>

					{loading ? (
						<div className="flex items-center justify-center py-12">
							<div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
						</div>
					) : rooms.length === 0 ? (
						<div className="rounded-lg border border-gray-200 bg-white py-12 text-center">
							<svg
								className="mx-auto mb-4 h-16 w-16 text-gray-400"
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
							<p className="text-sm text-gray-600">暂无房间</p>
							<p className="mt-1 text-xs text-gray-400">
								创建一个新房间开始协作吧
							</p>
						</div>
					) : (
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{rooms.map((room) => (
								<div
									key={room.id}
									onClick={() => handleEnterRoom(room.id)}
									className="group cursor-pointer rounded-lg border border-gray-200 bg-white p-5 transition-all duration-200 hover:border-blue-300 hover:shadow-md"
								>
									<div className="mb-3 flex items-start justify-between">
										<div className="min-w-0 flex-1">
											<h4 className="truncate text-base font-semibold text-gray-900 transition-colors group-hover:text-blue-600">
												{room.name}
											</h4>
											<p className="mt-1.5 flex items-center gap-1 text-xs text-gray-500">
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
										<button
											onClick={(e) => handleDeleteRoom(e, room.id)}
											className="rounded p-1.5 text-gray-400 opacity-0 transition-all duration-200 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
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
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
