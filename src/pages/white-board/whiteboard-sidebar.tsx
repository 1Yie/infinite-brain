import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { roomApi } from '../../api/room';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface WhiteboardSidebarProps {
	isConnected: boolean;
	isConnecting: boolean;
	user: { name: string } | null;
	userCount: number;
	scale: number;
	coords: { x: number; y: number };
	roomId: string;
}

export const WhiteboardSidebar: React.FC<WhiteboardSidebarProps> = ({
	isConnected,
	isConnecting,
	userCount,
	scale,
	coords,
	roomId,
}) => {
	const [roomName, setRoomName] = useState<string>(roomId);
	const [showUserMenu, setShowUserMenu] = React.useState(false);
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
							isConnected
								? 'animate-pulse bg-emerald-500'
								: isConnecting
									? 'animate-pulse bg-yellow-500'
									: 'bg-gray-400'
						}`}
					/>
					<span
						className={`flex items-center gap-2 text-sm font-medium ${
							isConnected
								? 'text-emerald-600'
								: isConnecting
									? 'text-yellow-600'
									: 'text-gray-500'
						}`}
					>
						{isConnecting && <Spinner className="h-3 w-3" />}
						{isConnecting ? '正在连接...' : isConnected ? '已连接' : '等待连接'}
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
				<Button
					onClick={() => navigate('/room')}
					variant="outline"
					className="w-full"
				>
					← 返回房间列表
				</Button>
			</div>
		</div>
	);
};
