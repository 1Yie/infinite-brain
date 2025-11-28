import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { ArrowLeft } from 'lucide-react';
import { BoardStats } from './board-stats';

export function WhiteboardPage() {
	const navigate = useNavigate();
	const { user } = useAuth();

	// 房间状态
	const [rooms, setRooms] = useState<Room[]>([]);
	const [loading, setLoading] = useState(true);

	// 创建房间状态
	const [newRoomName, setNewRoomName] = useState('');
	const [isPrivateRoom, setIsPrivateRoom] = useState(false);
	const [roomPassword, setRoomPassword] = useState('');
	const [isCreating, setIsCreating] = useState(false);

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
			const data = await roomApi.getRooms();
			setRooms(data);

			// 获取用户统计数据
			const stats = await roomApi.getUserStats();
			setUserStats(stats);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchRooms();
	}, [fetchRooms]);

	// 创建房间处理
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

			// 如果是创建者，设置房间授权状态，避免跳转后还要输入密码
			if (isPrivateRoom) {
				sessionStorage.setItem(`room_auth_${roomId}`, 'true');
			}

			navigate(`/whiteboard/${roomId}`);
		} finally {
			setIsCreating(false);
		}
	};

	// 进入房间处理
	const handleEnterRoom = (roomId: string) => {
		const room = rooms.find((r) => r.id === roomId);
		if (room?.isPrivate) {
			setJoinRoomId(roomId);
			setIsJoinDialogOpen(true);
		} else {
			navigate(`/whiteboard/${roomId}`);
		}
	};

	// 加入私密房间处理
	const handleJoinRoom = async () => {
		try {
			await roomApi.joinRoom(joinRoomId, joinPassword);
			sessionStorage.setItem(`room_auth_${joinRoomId}`, 'true');
			setIsJoinDialogOpen(false);
			setJoinPassword('');
			navigate(`/whiteboard/${joinRoomId}`);
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
			await roomApi.deleteRoom(roomToDelete);
			setRooms((prev) => prev.filter((r) => r.id !== roomToDelete));
			setRoomToDelete(null);
		}
		setIsConfirmDeleteOpen(false);
	};

	// 渲染房间创建时间
	const renderRoomCreatedAt = (room: Room) => {
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
		<div className="min-h-screen dark:bg-zinc-900">
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
							返回
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
								白板房间
							</h1>
						</div>
					</div>
				</div>
			</header>

			<div className="flex flex-1 dark:bg-zinc-900">
				<main className="flex-1 overflow-auto">
					<div className="mx-auto max-w-6xl p-8">
						{/* 用户统计 */}
						<BoardStats user={user} rooms={rooms} userStats={userStats} />

						{/* 页面标题 */}
						<header className="mb-8">
							<h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
								房间大厅
							</h2>
							<p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
								创建或加入房间，开始协作
							</p>
						</header>

						{/* 创建房间 */}
						<div className="mb-8 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
							<h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
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
								<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
									{rooms.map((room) => (
										<div
											key={room.id}
											onClick={() => handleEnterRoom(room.id)}
											className={`group cursor-pointer rounded-xl border bg-white p-5 transition-all hover:border-zinc-400 hover:shadow-md dark:bg-zinc-800 ${
												room.id === 'default-room'
													? 'border-zinc-300 bg-zinc-50/50 dark:border-zinc-600 dark:bg-zinc-700/50'
													: 'border-zinc-200 dark:border-zinc-700'
											}`}
										>
											<div className="mb-3 flex items-start justify-between">
												<div className="min-w-0 flex-1">
													<h4 className="flex items-center gap-2 truncate text-base font-semibold text-zinc-900 transition-colors group-hover:text-zinc-700 dark:text-zinc-100 dark:group-hover:text-zinc-300">
														{room.name}
														{room.isPrivate && (
															<svg
																className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400"
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
																默认
															</span>
														)}
													</h4>
													<p className="mt-1.5 flex items-center text-xs text-zinc-500 dark:text-zinc-400">
														{room.id === 'default-room' ? (
															renderRoomCreatedAt(room)
														) : (
															<>
																<span className="flex items-center gap-1.5">
																	<svg
																		className="h-3.5 w-3.5"
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
																</span>
																{room.creatorName && (
																	<>
																		<span className="mx-1.5 text-base text-zinc-500 dark:text-zinc-400">
																			·
																		</span>
																		<span className="flex items-center gap-1.5">
																			<svg
																				className="h-3.5 w-3.5"
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
																			{room.creatorName}
																		</span>
																	</>
																)}
															</>
														)}
													</p>
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
