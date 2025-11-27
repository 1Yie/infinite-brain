import { useEffect, useState, useCallback } from 'react';
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
import { RoomSidebar } from './room-sidebar';
import { RoomContent } from './room-content';

export function RoomPage() {
	const { user, logout } = useAuth();
	const [rooms, setRooms] = useState<Room[]>([]);
	const [loading, setLoading] = useState(true);
	const [newRoomName, setNewRoomName] = useState('');
	const [isPrivateRoom, setIsPrivateRoom] = useState(false);
	const [roomPassword, setRoomPassword] = useState('');
	const [isCreating, setIsCreating] = useState(false);
	const [showUserMenu, setShowUserMenu] = useState(false);
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
	}, [fetchRooms]);

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
			return (
				<span className="flex items-center gap-1.5 text-xs text-zinc-500">
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
		<div className="flex min-h-screen bg-zinc-50">
			<RoomSidebar
				user={user}
				rooms={rooms}
				userStats={userStats}
				showUserMenu={showUserMenu}
				setShowUserMenu={setShowUserMenu}
				handleLogout={handleLogout}
			/>

			<RoomContent
				user={user}
				rooms={rooms}
				loading={loading}
				newRoomName={newRoomName}
				setNewRoomName={setNewRoomName}
				isPrivateRoom={isPrivateRoom}
				setIsPrivateRoom={setIsPrivateRoom}
				roomPassword={roomPassword}
				setRoomPassword={setRoomPassword}
				isCreating={isCreating}
				handleCreateRoom={handleCreateRoom}
				handleEnterRoom={handleEnterRoom}
				handleDeleteRoom={handleDeleteRoom}
				renderRoomCreatedAt={renderRoomCreatedAt}
			/>

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
