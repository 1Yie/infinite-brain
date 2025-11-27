import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { guessDrawApi } from '@/api/guess-draw';
import { SetTitle } from '@/utils/set-title';
import {
	ArrowLeft,
	Plus,
	Search,
	Users,
	Clock,
	Loader2,
	Gamepad2,
	Circle,
	ArrowRight,
} from 'lucide-react';

// 使用API中定义的GuessDrawRoom类型
interface GuessDrawRoom {
	id: string;
	name: string;
	ownerId: string;
	ownerName: string;
	maxPlayers: number;
	currentPlayers: number;
	rounds: number;
	roundTime: number;
	isPrivate: boolean;
	status: 'waiting' | 'playing' | 'finished';
	createdAt: string;
}

export function GuessDrawLobby() {
	// 状态
	const [rooms, setRooms] = useState<GuessDrawRoom[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const navigate = useNavigate();

	// 获取房间列表
	// 注意：这里假设有一个获取房间列表的API，如果没有，需要实现
	const fetchRooms = async () => {
		setIsLoading(true);
		setError(null);

		try {
			const response = await guessDrawApi.getRooms();

			setRooms(response.data?.rooms || []);
		} catch (err) {
			setError('获取房间列表失败');
			console.error(err);
		} finally {
			setIsLoading(false);
		}
	};

	// 加入房间
	const handleJoinRoom = (roomId: string) => {
		navigate(`/play/guess-draw/join?roomId=${roomId}`);
	};

	// 创建房间
	const handleCreateRoom = () => {
		navigate('/play/guess-draw/create');
	};

	// 初始化
	useEffect(() => {
		fetchRooms();
	}, []);

	return (
		<div className="min-h-screen bg-gray-50">
			<SetTitle title="你猜我画 - 房间列表" />

			{/* 顶部导航栏 */}
			<header className="border-b bg-white shadow-sm">
				<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
					<div className="flex h-16 items-center justify-between">
						<div className="flex items-center">
							<Button
								variant="ghost"
								onClick={() => navigate('/room')}
								className="mr-4"
							>
								<ArrowLeft className="mr-2 h-4 w-4" />
								返回
							</Button>
							<h1 className="flex items-center text-xl font-semibold">
								<Gamepad2 className="mr-2 h-6 w-6" />
								你猜我画
							</h1>
						</div>
						<div className="flex items-center space-x-4">
							<Button onClick={() => navigate('/play/guess-draw/create')}>
								<Plus className="mr-2 h-4 w-4" />
								创建房间
							</Button>
						</div>
					</div>
				</div>
			</header>

			<div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
				<div className="mb-6">
					<h2 className="text-2xl font-bold text-gray-900">房间列表</h2>
					<p className="text-gray-600">选择一个房间加入，或者创建自己的房间</p>
				</div>

				{isLoading ? (
					<div className="flex justify-center py-12">
						<div className="text-center">
							<Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin" />
							<p>加载房间列表中...</p>
						</div>
					</div>
				) : error ? (
					<div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4">
						<p className="text-red-700">{error}</p>
						<Button variant="outline" onClick={fetchRooms} className="mt-2">
							重试
						</Button>
					</div>
				) : rooms.length === 0 ? (
					<div className="py-12 text-center">
						<div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100">
							<Search className="h-12 w-12 text-gray-400" />
						</div>
						<h3 className="mb-2 text-lg font-medium text-gray-900">
							没有可用的房间
						</h3>
						<p className="mb-6 text-gray-600">创建一个新房间开始游戏吧！</p>
						<Button onClick={() => handleCreateRoom()}>
							<Plus className="mr-2 h-4 w-4" />
							创建房间
						</Button>
					</div>
				) : (
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
						{rooms.map((room) => (
							<Card key={room.id} className="overflow-hidden">
								<CardHeader className="pb-3">
									<div className="flex items-start justify-between">
										<CardTitle className="text-lg">{room.name}</CardTitle>
										<Badge
											variant={
												room.status === 'playing' ? 'default' : 'secondary'
											}
										>
											{room.status === 'playing'
												? '游戏中'
												: room.status === 'waiting'
													? '等待中'
													: '已结束'}
										</Badge>
									</div>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="flex items-center justify-between">
										<div className="flex items-center text-sm text-gray-600">
											<Users className="mr-1 h-4 w-4" />
											<span>
												{room.currentPlayers}/{room.maxPlayers} 玩家
											</span>
										</div>
										{room.isPrivate && (
											<div className="flex items-center space-x-1">
												<Circle className="h-3 w-3 fill-current text-amber-500" />
												<span className="text-xs text-amber-600">私密</span>
											</div>
										)}
										<div className="flex items-center text-sm text-gray-600">
											<Clock className="mr-1 h-4 w-4" />
											<span>{room.roundTime}秒/回合</span>
										</div>
									</div>

									<div className="space-y-2">
										<p className="text-sm font-medium">房间信息:</p>
										<div className="text-sm text-gray-600">
											<p>房主: {room.ownerName}</p>
											<p>回合数: {room.rounds}</p>
										</div>
									</div>

									<Button
										onClick={() => handleJoinRoom(room.id)}
										className="w-full"
										disabled={
											room.status === 'playing' &&
											room.currentPlayers >= room.maxPlayers
										}
									>
										{room.status === 'playing' ? '观战' : '加入房间'}
										<ArrowRight className="ml-1 h-3 w-3" />
									</Button>
								</CardContent>
							</Card>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
