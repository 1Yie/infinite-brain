import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { boardApi, type BoardRoom } from '../../api/board';
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
import { ArrowLeft, Plus, RefreshCw } from 'lucide-react';
import { BoardStats } from './board-stats';

export function WhiteboardPage() {
	const navigate = useNavigate();
	const { user } = useAuth();

	// 房间状态
	const [rooms, setRooms] = useState<BoardRoom[]>([]);
	const [loading, setLoading] = useState(true);

	// UI 状态
	const [alertMessage, setAlertMessage] = useState('');
	const [isAlertOpen, setIsAlertOpen] = useState(false);

	// 删除房间状态
	const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
	const [roomToDelete, setRoomToDelete] = useState<string | null>(null);
	const [roomNameToDelete, setRoomNameToDelete] = useState<string>('');

	// 加入房间状态
	const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
	const [joinRoomId, setJoinRoomId] = useState<string>('');
	const [joinPassword, setJoinPassword] = useState('');

	// 用户统计数据
	const [userStats, setUserStats] = useState({
		totalStrokes: 0,
		todayStrokes: 0,
		totalPixels: 0,
		todayPixels: 0,
	});

	// 获取房间列表
	const fetchRooms = useCallback(async () => {
		try {
			setLoading(true);
			const data = await boardApi.getRooms();
			setRooms(data);

			// 获取用户统计数据
			const stats = await boardApi.getUserStats();
			setUserStats(stats);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchRooms();
	}, [fetchRooms]);

	// 进入房间处理
	const handleEnterRoom = (roomId: string) => {
		const room = rooms.find((r) => r.id === roomId);
		if (room?.isPrivate) {
			setJoinRoomId(roomId);
			setIsJoinDialogOpen(true);
		} else {
			navigate(`/room/whiteboard/${roomId}`);
		}
	};

	// 加入私密房间处理
	const handleJoinRoom = async () => {
		try {
			await boardApi.joinRoom(joinRoomId, joinPassword);
			sessionStorage.setItem(`room_auth_${joinRoomId}`, 'true');
			setIsJoinDialogOpen(false);
			setJoinPassword('');
			navigate(`/room/whiteboard/${joinRoomId}`);
		} catch (error) {
			setAlertMessage(error instanceof Error ? error.message : '加入房间失败');
			setIsAlertOpen(true);
		}
	};

	// 删除房间处理
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

	// 确认删除房间
	const confirmDeleteRoom = async () => {
		if (roomToDelete) {
			await boardApi.deleteRoom(roomToDelete);
			setRooms((prev) => prev.filter((r) => r.id !== roomToDelete));
			setRoomToDelete(null);
		}
		setIsConfirmDeleteOpen(false);
	};

	// 渲染房间创建时间
	const renderRoomCreatedAt = (room: BoardRoom) => {
		if (room.id === 'default-room') {
			return (
				<span className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
					<svg
						className="h-3.5 w-3.5"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<circle cx="12" cy="12" r="10" strokeWidth={2} />
					</svg>
					系统默认
				</span>
			);
		}

		return new Date(room.createdAt!).toLocaleDateString('zh-CN', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		});
	};

	return (
		<div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
			{/* 顶部导航栏 */}
			<header className="sticky top-0 z-10 border-b bg-white px-4 py-3 sm:px-6 lg:px-8 dark:bg-gray-800">
				<div className="mx-auto flex max-w-7xl items-center justify-between">
					<div className="flex items-center gap-4">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => navigate('/room')}
							className="text-gray-600 dark:text-gray-400"
						>
							<ArrowLeft className="mr-1 h-4 w-4" />
							返回大厅
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
									d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
								/>
							</svg>
							<h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
								无限画布
							</h1>
						</div>
					</div>
					<div className="flex items-center gap-3">
						<Button
							variant="ghost"
							size="sm"
							onClick={fetchRooms}
							disabled={loading}
							className="text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
						>
							<RefreshCw
								className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`}
							/>
							刷新
						</Button>
						<Button
							variant="default"
							size="sm"
							onClick={() => navigate('/room/whiteboard/create')}
							className="bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
						>
							<Plus className="mr-1 h-4 w-4" />
							创建房间
						</Button>
					</div>
				</div>
			</header>

			<div className="min-h-screen bg-gray-50 dark:bg-gray-900">
				<main className="flex-1 overflow-auto">
					<div className="mx-auto max-w-6xl p-8">
						{/* 用户统计 */}
						<BoardStats user={user} rooms={rooms} userStats={userStats} />

						{/* 房间列表 */}
						<div>
							<div className="mb-4 flex items-center justify-between">
								<h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
									房间列表
									{!loading && (
										<span className="ml-2 text-sm font-normal text-zinc-500 dark:text-zinc-400">
											({rooms.length} 个房间)
										</span>
									)}
								</h3>
							</div>

							{loading ? (
								<div className="flex items-center justify-center rounded-xl border border-zinc-200 bg-white py-16 dark:border-zinc-700 dark:bg-zinc-800">
									<div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent dark:border-zinc-100"></div>
								</div>
							) : rooms.length === 0 ? (
								<div className="rounded-xl border border-zinc-200 bg-white py-16 text-center dark:border-zinc-700 dark:bg-zinc-800">
									<svg
										className="mx-auto mb-4 h-16 w-16 text-zinc-300 dark:text-zinc-600"
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
									<p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
										暂无房间
									</p>
									<p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
										创建一个新房间开始协作吧
									</p>
								</div>
							) : (
								<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
									{rooms.map((room) => (
										<div
											key={room.id}
											onClick={() => handleEnterRoom(room.id)}
											className="group flex flex-col rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-gray-400 hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
										>
											{/* 头部：名称与状态 */}
											<div className="mb-4 flex items-start justify-between">
												<div className="min-w-0 pr-2">
													<div className="mb-1 flex items-center gap-1.5">
														<h3
															className="truncate font-bold text-gray-900 dark:text-zinc-100"
															title={room.name}
														>
															{room.name}
														</h3>
														{room.isPrivate && (
															<svg
																className="h-3 w-3 text-amber-500"
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
															<span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
																官方
															</span>
														)}
													</div>
													{room.id !== 'default-room' ? (
														<div className="flex items-center gap-1 font-mono text-xs text-gray-400 dark:text-zinc-400">
															<svg
																className="h-3 w-3"
																fill="none"
																stroke="currentColor"
																viewBox="0 0 24 24"
															>
																<path
																	strokeLinecap="round"
																	strokeLinejoin="round"
																	strokeWidth={2}
																	d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
																/>
															</svg>
															{renderRoomCreatedAt(room)}
														</div>
													) : (
														<div className="flex items-center gap-1 text-xs text-gray-400 dark:text-zinc-400">
															INFINITE BRAIN
														</div>
													)}
												</div>
											</div>

											{/* 底部：房主与按钮 */}
											<div className="mt-auto flex items-center justify-between pt-1">
												<div className="flex items-center gap-2 overflow-hidden">
													{room.id === 'default-room' ? (
														<div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-700">
															<svg
																className="h-3.5 w-3.5 text-gray-500 dark:text-zinc-400"
																fill="none"
																stroke="currentColor"
																viewBox="0 0 24 24"
															>
																<path
																	strokeLinecap="round"
																	strokeLinejoin="round"
																	strokeWidth={2}
																	d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
																/>
															</svg>
														</div>
													) : (
														<div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-zinc-700">
															<svg
																className="h-3.5 w-3.5 text-gray-500 dark:text-zinc-400"
																fill="none"
																stroke="currentColor"
																viewBox="0 0 24 24"
															>
																<path
																	strokeLinecap="round"
																	strokeLinejoin="round"
																	strokeWidth={2}
																	d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
																/>
															</svg>
														</div>
													)}
													{room.id === 'default-room' ? (
														<span
															className="truncate text-xs font-medium text-gray-600 dark:text-zinc-400"
															title="系统默认房间"
														></span>
													) : room.creatorName ? (
														<span
															className="truncate text-xs font-medium text-gray-600 dark:text-zinc-400"
															title={room.creatorName}
														>
															{room.creatorName}
														</span>
													) : (
														<span className="truncate text-xs font-medium text-gray-600 dark:text-zinc-400">
															未知创建者
														</span>
													)}
												</div>

												{room.id !== 'default-room' &&
													room.ownerId === user?.id?.toString() && (
														<button
															onClick={(e) => handleDeleteRoom(e, room.id)}
															className="rounded p-1.5 text-zinc-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
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

				{/* 提示对话框 */}
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

				{/* 确认删除对话框 */}
				<AlertDialog
					open={isConfirmDeleteOpen}
					onOpenChange={setIsConfirmDeleteOpen}
				>
					<AlertDialogPopup>
						<AlertDialogHeader>
							<AlertDialogTitle>确认删除</AlertDialogTitle>
							<AlertDialogDescription>
								确认删除房间 "{roomNameToDelete}" ？
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

				{/* 加入房间对话框 */}
				<AlertDialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
					<AlertDialogPopup>
						<AlertDialogHeader>
							<AlertDialogTitle>加入私密房间</AlertDialogTitle>
							<AlertDialogDescription>
								#{joinRoomId}
								<br />
								该房间需要密码才能加入。
							</AlertDialogDescription>
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
								className="w-full"
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
		</div>
	);
}
