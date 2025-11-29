import type { Room } from '../../api/room';
import type { User } from '../../api/auth';

interface BoardStatsProps {
	user: User | null;
	rooms: Room[];
	userStats: {
		totalStrokes: number;
		todayStrokes: number;
		totalPixels: number;
		todayPixels: number;
	};
}

export function BoardStats({ user, rooms, userStats }: BoardStatsProps) {
	return (
		<div className="mb-8 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
			<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
				<div className="text-center">
					<div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
						{
							rooms.filter((room) => room.ownerId === user?.id?.toString())
								.length
						}
					</div>
					<div className="text-sm text-gray-600 dark:text-gray-400">
						我的房间
					</div>
				</div>
				<div className="text-center">
					<div className="text-2xl font-bold text-zinc-800 dark:text-zinc-200">
						{userStats.todayStrokes}
					</div>
					<div className="text-sm text-gray-600 dark:text-gray-400">
						今日笔画
					</div>
				</div>
				<div className="text-center">
					<div className="text-2xl font-bold text-zinc-700 dark:text-zinc-300">
						{userStats.totalStrokes.toLocaleString()}
					</div>
					<div className="text-sm text-gray-600 dark:text-gray-400">
						总共笔画
					</div>
				</div>
				<div className="text-center">
					<div className="text-2xl font-bold text-zinc-600 dark:text-zinc-400">
						{userStats.totalPixels.toLocaleString()}
					</div>
					<div className="text-sm text-gray-600 dark:text-gray-400">
						总共像素
					</div>
				</div>
			</div>
		</div>
	);
}
