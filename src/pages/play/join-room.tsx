import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { guessDrawApi } from '@/api/guess-draw';
import { SetTitle } from '@/utils/set-title';
import { ArrowLeft, Search, Plus, Users } from 'lucide-react';

interface Room {
	roomId: string;
	gameState: {
		isActive: boolean;
		players: Array<{
			userId: string;
			username: string;
		}>;
	};
}

export function JoinGuessDrawRoom() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	// 状态
	const [roomId, setRoomId] = useState('');
	const [isJoining, setIsJoining] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// 如果URL中有roomId参数，自动填充
	useEffect(() => {
		const roomIdFromUrl = searchParams.get('roomId');
		if (roomIdFromUrl) {
			setRoomId(roomIdFromUrl);
		}
	}, [searchParams]);

	// 加入房间
	const handleJoinRoom = async () => {
		if (!roomId.trim()) {
			setError('请输入房间ID');
			return;
		}

		setIsJoining(true);
		setError(null);

		try {
			const response = await guessDrawApi.joinRoom(roomId.trim());

			if (response.success && response.data) {
				// 加入成功，跳转到游戏页面
				navigate(`/play/guess-draw/${response.data.roomId}`);
			} else {
				setError(response.message || '加入房间失败');
			}
		} catch (err) {
			setError('加入房间失败');
			console.error(err);
		} finally {
			setIsJoining(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
			<SetTitle title="加入你猜我画房间" />

			<div className="w-full max-w-md">
				<Card>
					<CardHeader>
						<CardTitle className="text-center text-xl">
							加入你猜我画房间
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-6">
						{error && (
							<div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
								{error}
							</div>
						)}

						<div className="space-y-2">
							<label htmlFor="roomId" className="text-sm font-medium">
								房间ID
							</label>
							<div className="flex space-x-2">
								<Input
									id="roomId"
									placeholder="请输入房间ID"
									value={roomId}
									onChange={(e) => setRoomId(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter') {
											handleJoinRoom();
										}
									}}
								/>
								<Button
									onClick={handleJoinRoom}
									disabled={!roomId.trim() || isJoining}
								>
									{isJoining ? (
										'加入中...'
									) : (
										<>
											<Search className="mr-2 h-4 w-4" />
											加入
										</>
									)}
								</Button>
							</div>
						</div>

						<div className="rounded-md bg-blue-50 p-4">
							<h3 className="mb-2 font-medium text-blue-900">游戏说明</h3>
							<div className="space-y-1 text-sm text-blue-800">
								<p>• 你猜我画是一款多人在线绘画猜词游戏</p>
								<p>• 每位玩家轮流成为画者，根据词语画出提示</p>
								<p>• 其他玩家根据画作猜测词语，猜对越快得分越高</p>
								<p>• 需要至少2名玩家才能开始游戏</p>
							</div>
						</div>

						<div className="flex space-x-3 pt-2">
							<Button
								variant="outline"
								onClick={() => navigate('/room')}
								className="flex-1"
							>
								<ArrowLeft className="mr-2 h-4 w-4" />
								返回
							</Button>
							<Button
								onClick={() => navigate('/play/guess-draw/create')}
								className="flex-1"
							>
								<Plus className="mr-2 h-4 w-4" />
								创建房间
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
