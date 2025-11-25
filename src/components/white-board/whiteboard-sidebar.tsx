import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/auth-context';
import { useNavigate } from 'react-router-dom';
import { roomApi } from '../../api/room';

interface WhiteboardSidebarProps {
	isConnected: boolean;
	user: { name: string } | null;
	userCount: number;
	scale: number;
	coords: { x: number; y: number };
	roomId: string;
}

export const WhiteboardSidebar: React.FC<WhiteboardSidebarProps> = ({
	isConnected,
	user,
	userCount,
	scale,
	coords,
	roomId,
}) => {
	const [roomName, setRoomName] = useState<string>(roomId);
	const [showUserMenu, setShowUserMenu] = React.useState(false);
	const { logout } = useAuth();
	const menuRef = React.useRef<HTMLDivElement>(null);
	const navigate = useNavigate();

	useEffect(() => {
		const fetchRoomName = async () => {
			try {
				const rooms = await roomApi.getRooms();
				const room = rooms.find((r) => r.id === roomId);
				if (room) {
					setRoomName(room.name);
				}
			} catch (error) {
				console.error('获取房间名称失败:', error);
			}
		};

		fetchRoomName();
	}, [roomId]);

	const handleLogout = async () => {
		try {
			await logout();
			setShowUserMenu(false);
		} catch (error) {
			console.error('退出登录失败:', error);
		}
	};

	React.useEffect(() => {
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

	return (
		<div className="flex h-full w-64 flex-col border-r border-gray-200 bg-white shadow-lg">
			{/* 状态信息 */}
			<div className="flex-1 space-y-7 p-6">
				{/* 连接状态 */}
				<div className="flex items-center gap-3">
					<div
						className={`h-2.5 w-2.5 rounded-full ${
							isConnected ? 'animate-pulse bg-emerald-500' : 'bg-red-500'
						}`}
					/>
					<span
						className={`text-sm font-medium ${
							isConnected ? 'text-emerald-600' : 'text-red-600'
						}`}
					>
						{isConnected ? '已连接' : '连接已断开'}
					</span>
				</div>

				<div className="border-t border-gray-200"></div>

				{/* 房间名字 */}
				<div className="space-y-2">
					<div className="text-xs font-medium tracking-wider text-gray-500 uppercase">
						房间名称
					</div>
					<div className="text-sm font-semibold text-gray-700">{roomName}</div>
				</div>

				<div className="border-t border-gray-200"></div>

				{/* 在线人数 */}
				<div className="space-y-2">
					<div className="text-xs font-medium tracking-wider text-gray-500 uppercase">
						在线人数
					</div>
					<div className="flex items-baseline gap-2">
						<span className="text-4xl font-bold text-blue-600">
							{userCount}
						</span>
					</div>
				</div>

				<div className="border-t border-gray-200"></div>

				{/* 缩放级别 */}
				<div className="space-y-2">
					<div className="text-xs font-medium tracking-wider text-gray-500 uppercase">
						缩放级别
					</div>
					<div className="flex items-center gap-3">
						<span className="text-right text-sm font-semibold text-gray-700">
							{(scale * 100).toFixed(0)}%
						</span>
					</div>
				</div>

				<div className="border-t border-gray-200"></div>

				{/* 坐标位置 */}
				<div className="space-y-2">
					<div className="text-xs font-medium tracking-wider text-gray-500 uppercase">
						坐标位置
					</div>
					<div className="flex gap-4 text-sm">
						<div>
							<span className="font-medium text-gray-500">X:</span>{' '}
							<span className="font-mono font-semibold text-gray-800">
								{coords.x}
							</span>
						</div>
						<div>
							<span className="font-medium text-gray-500">Y:</span>{' '}
							<span className="font-mono font-semibold text-gray-800">
								{coords.y}
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* 返回房间列表 */}
			<div className="px-6 pb-4">
				<button
					onClick={() => navigate('/')}
					className="w-full rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-200"
				>
					← 返回房间列表
				</button>
			</div>

			{/* 用户信息区域 */}
			{user && (
				<div className="border-t border-gray-200">
					<div className="relative" ref={menuRef}>
						<button
							onClick={() => setShowUserMenu(!showUserMenu)}
							className="flex w-full items-center justify-between p-2 transition-colors duration-200 hover:bg-gray-50"
						>
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-blue-600 text-sm font-semibold text-white">
									{user?.name.charAt(0).toUpperCase()}
								</div>
								<div className="text-left">
									<div className="text-sm font-semibold text-gray-800">
										{user?.name}
									</div>
								</div>
							</div>
							<svg
								className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
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
							className={`absolute right-3 bottom-full left-3 mb-2 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg transition-all duration-200 ease-out ${
								showUserMenu
									? 'translate-y-0 scale-100 opacity-100'
									: 'pointer-events-none translate-y-2 scale-95 opacity-0'
							}`}
						>
							<button className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left text-sm font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-50">
								<svg
									className="h-4 w-4 text-gray-500"
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
	);
};
