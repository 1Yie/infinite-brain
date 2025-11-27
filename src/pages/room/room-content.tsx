import { type Room } from '../../api/room';
import { type User } from '../../api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

interface RoomContentProps {
	user: User | null;
	rooms: Room[];
	loading: boolean;
	newRoomName: string;
	setNewRoomName: (name: string) => void;
	isPrivateRoom: boolean;
	setIsPrivateRoom: (isPrivate: boolean) => void;
	roomPassword: string;
	setRoomPassword: (password: string) => void;
	isCreating: boolean;
	handleCreateRoom: (e: React.FormEvent) => void;
	handleEnterRoom: (roomId: string) => void;
	handleDeleteRoom: (e: React.MouseEvent, roomId: string) => void;
	renderRoomCreatedAt: (room: Room) => React.ReactNode;
}

export function RoomContent({
	user,
	rooms,
	loading,
	newRoomName,
	setNewRoomName,
	isPrivateRoom,
	setIsPrivateRoom,
	roomPassword,
	setRoomPassword,
	isCreating,
	handleCreateRoom,
	handleEnterRoom,
	handleDeleteRoom,
	renderRoomCreatedAt,
}: RoomContentProps) {
	return (
		<main className="flex-1 overflow-auto">
			<div className="mx-auto max-w-6xl p-8">
				{/* 页面标题 */}
				<header className="mb-8">
					<h2 className="text-2xl font-bold text-zinc-900">房间大厅</h2>
					<p className="mt-1 text-sm text-zinc-600">创建或加入房间，开始协作</p>
				</header>

				{/* 创建房间 */}
				<div className="mb-8 rounded-xl border border-zinc-200 bg-white p-6">
					<h3 className="mb-4 text-lg font-semibold text-zinc-900">新建房间</h3>
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
											<p className="mt-1.5 flex items-center text-xs text-zinc-500">
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
																<span className="mx-1.5 text-base text-zinc-500">
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
	);
}
