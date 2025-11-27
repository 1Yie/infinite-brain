import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { guessDrawApi } from '@/api/guess-draw';
import { SetTitle } from '@/utils/set-title';
import { ArrowLeft, Plus, Users, Clock } from 'lucide-react';

export function CreateGuessDrawRoom() {
	const navigate = useNavigate();

	// 表单状态
	const [totalRounds, setTotalRounds] = useState(5);
	const [roundTimeLimit, setRoundTimeLimit] = useState(60); // 默认60秒
	const [isCreating, setIsCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// 创建房间
	const handleCreateRoom = async () => {
		setIsCreating(true);
		setError(null);

		try {
			const response = await guessDrawApi.createRoom({
				totalRounds,
				roundTimeLimit: roundTimeLimit * 1000, // 转换为毫秒
			});

			if (response.success && response.data) {
				// 创建成功，跳转到游戏页面
				navigate(`/play/guess-draw/${response.data.roomId}`);
			} else {
				setError(response.message || '创建房间失败');
			}
		} catch (err) {
			setError('创建房间失败');
			console.error(err);
		} finally {
			setIsCreating(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
			<SetTitle title="创建你猜我画房间" />

			<div className="w-full max-w-md">
				<Card>
					<CardHeader>
						<CardTitle className="text-center text-xl">
							创建你猜我画房间
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-6">
						{error && (
							<div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
								{error}
							</div>
						)}

						<div className="space-y-2">
							<Label htmlFor="totalRounds">游戏回合数</Label>
							<div className="flex items-center space-x-2">
								<Input
									id="totalRounds"
									type="number"
									min="1"
									max="20"
									value={totalRounds}
									onChange={(e) => setTotalRounds(Number(e.target.value))}
								/>
								<span className="text-sm text-gray-500">回合</span>
							</div>
							<p className="text-xs text-gray-500">每位玩家轮流画画的次数</p>
						</div>

						<div className="space-y-2">
							<Label htmlFor="roundTimeLimit">每回合时间限制</Label>
							<div className="flex items-center space-x-2">
								<Input
									id="roundTimeLimit"
									type="number"
									min="30"
									max="300"
									value={roundTimeLimit}
									onChange={(e) => setRoundTimeLimit(Number(e.target.value))}
								/>
								<span className="text-sm text-gray-500">秒</span>
							</div>
							<p className="text-xs text-gray-500">每回合画画的时长</p>
						</div>

						<div className="rounded-md bg-blue-50 p-4">
							<h3 className="mb-2 font-medium text-blue-900">游戏设置预览</h3>
							<div className="space-y-1 text-sm text-blue-800">
								<div className="flex items-center">
									<Users className="mr-2 h-4 w-4" />
									<span>游戏回合: {totalRounds} 回合</span>
								</div>
								<div className="flex items-center">
									<Clock className="mr-2 h-4 w-4" />
									<span>每回合时长: {roundTimeLimit} 秒</span>
								</div>
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
								onClick={handleCreateRoom}
								disabled={isCreating}
								className="flex-1"
							>
								{isCreating ? (
									'创建中...'
								) : (
									<>
										<Plus className="mr-2 h-4 w-4" />
										创建房间
									</>
								)}
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
