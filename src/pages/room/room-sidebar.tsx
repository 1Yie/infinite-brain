import { useRef, useEffect } from 'react';
import type { Room } from '../../api/room';
import type { User } from '../../api/auth';
import { Button } from '@/components/ui/button';
import { Gamepad2 } from 'lucide-react';

interface RoomSidebarProps {
	user: User | null;
	rooms: Room[];
	userStats: {
		totalStrokes: number;
		todayStrokes: number;
		totalPixels: number;
		todayPixels: number;
	};
	showUserMenu: boolean;
	setShowUserMenu: (show: boolean) => void;
	handleLogout: () => void;
}

export function RoomSidebar({
	user,
	rooms,
	userStats,
	showUserMenu,
	setShowUserMenu,
	handleLogout,
}: RoomSidebarProps) {
	const menuRef = useRef<HTMLDivElement>(null);

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
	}, [showUserMenu, setShowUserMenu]);

	return (
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
							<p className="text-xs tracking-widest text-zinc-500">无限画布</p>
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
									{
										rooms.filter(
											(room) => room.ownerId === user?.id?.toString()
										).length
									}
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

						{/* 你猜我画游戏入口 */}
						<Button
							onClick={() => (window.location.href = '/play/guess-draw')}
							className="mt-6 w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700"
						>
							<Gamepad2 className="mr-2 h-4 w-4" />
							你猜我画
						</Button>
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
	);
}
