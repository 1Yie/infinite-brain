import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { guessDrawApi } from '@/api/guess-draw';
import {
	ArrowLeft,
	Plus,
	Clock,
	Trophy,
	Loader2,
	Gamepad2,
	Settings2,
	Users,
} from 'lucide-react';

export function CreateGuessDrawRoom() {
	const navigate = useNavigate();

	// 表单状态
	const [roomName, setRoomName] = useState('');
	const [totalRounds, setTotalRounds] = useState(3); // 默认3回合
	const [roundTimeLimit, setRoundTimeLimit] = useState(60); // 默认60秒
	const [isPrivate, setIsPrivate] = useState(false);
	const [password, setPassword] = useState('');
	const [isCreating, setIsCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// 快捷选项配置
	const ROUND_OPTIONS = [3, 5, 8, 10];
	const TIME_OPTIONS = [45, 60, 90, 120];

	// 创建房间
	const handleCreateRoom = async () => {
		if (!roomName) {
			setError('请输入房间名称');
			return;
		}

		if (isPrivate && !password) {
			setError('私密房间必须设置密码');
			return;
		}

		setIsCreating(true);
		setError(null);

		try {
			const response = await guessDrawApi.createRoom({
				totalRounds,
				roomName,
				roundTimeLimit: roundTimeLimit,
				isPrivate,
				password: isPrivate ? password : undefined,
			});

			if (response.success && response.data) {
				navigate(`/room/guess-draw/${response.data.roomId}`);
			} else {
				setError(response.message || '创建房间失败');
			}
		} catch (err) {
			setError('创建房间失败，请检查网络');
			console.error(err);
		} finally {
			setIsCreating(false);
		}
	};

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
			<div className="animate-in fade-in zoom-in-95 w-full max-w-lg duration-300">
				{/* 头部标题 */}
				<div className="mb-6 text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-black text-white shadow-lg">
						<Gamepad2 className="h-6 w-6" />
					</div>
					<h1 className="text-2xl font-bold text-gray-900">创建游戏房间</h1>
					<p className="mt-2 text-sm text-gray-500">
						自定义规则，开启一场精彩的创意对决
					</p>
				</div>

				{/* 表单容器 */}
				<div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
					{/* 错误提示 */}
					{error && (
						<div className="border-b border-red-100 bg-red-50 p-3 text-center text-sm text-red-600">
							{error}
						</div>
					)}

					<div className="space-y-8 p-6 md:p-8">
						{/* 回合数设置 */}
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<Label
									htmlFor="roomName"
									className="flex items-center gap-2 text-base font-semibold text-gray-800"
								>
									<Plus className="h-4 w-4 text-gray-500" />
									房间名称
								</Label>
							</div>
							<div className="relative mt-2">
								<Input
									id="roomName"
									type="text"
									value={roomName}
									onChange={(e) => setRoomName(e.target.value)}
									placeholder="输入房间名称"
									className="w-full"
								/>
							</div>
							<div className="flex items-center justify-between">
								<Label
									htmlFor="totalRounds"
									className="flex items-center gap-2 text-base font-semibold text-gray-800"
								>
									<Trophy className="h-4 w-4 text-gray-500" />
									游戏回合数
								</Label>
								<span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-sm font-bold text-gray-900">
									{totalRounds} 回合
								</span>
							</div>

							{/* 快捷选择 */}
							<div className="grid grid-cols-4 gap-2">
								{ROUND_OPTIONS.map((opt) => (
									<button
										key={opt}
										onClick={() => setTotalRounds(opt)}
										className={`rounded-lg border py-2 text-sm font-medium transition-all ${
											totalRounds === opt
												? 'border-black bg-black text-white shadow-md'
												: 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
										}`}
									>
										{opt}
									</button>
								))}
							</div>

							<div className="relative mt-2">
								<Input
									id="totalRounds"
									type="number"
									min="1"
									max="20"
									value={totalRounds}
									onChange={(e) => setTotalRounds(Number(e.target.value))}
									className="pr-12"
								/>
								<span className="pointer-events-none absolute top-1.5 right-3 text-sm text-gray-400">
									自定义
								</span>
							</div>
						</div>

						{/* 分割线 */}
						<div className="h-px w-full bg-gray-100" />

						{/* 时间限制设置 */}
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<Label
									htmlFor="roundTimeLimit"
									className="flex items-center gap-2 text-base font-semibold text-gray-800"
								>
									<Clock className="h-4 w-4 text-gray-500" />
									单回合时长
								</Label>
								<span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-sm font-bold text-gray-900">
									{roundTimeLimit} 秒
								</span>
							</div>

							{/* 快捷选择 */}
							<div className="grid grid-cols-4 gap-2">
								{TIME_OPTIONS.map((opt) => (
									<button
										key={opt}
										onClick={() => setRoundTimeLimit(opt)}
										className={`rounded-lg border py-2 text-sm font-medium transition-all ${
											roundTimeLimit === opt
												? 'border-black bg-black text-white shadow-md'
												: 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
										}`}
									>
										{opt}s
									</button>
								))}
							</div>

							<div className="relative mt-2">
								<Input
									id="roundTimeLimit"
									type="number"
									min="10"
									max="300"
									value={roundTimeLimit}
									onChange={(e) => setRoundTimeLimit(Number(e.target.value))}
									className="pr-12"
								/>
								<span className="pointer-events-none absolute top-1.5 right-3 text-sm text-gray-400">
									自定义
								</span>
							</div>
						</div>

						{/* 私密房间设置 */}
						<div className="space-y-3">
							<div className="flex items-center space-x-2">
								<Checkbox
									id="isPrivate"
									checked={isPrivate}
									onCheckedChange={(checked) => setIsPrivate(!!checked)}
								/>
								<Label
									htmlFor="isPrivate"
									className="flex items-center gap-2 text-base font-semibold text-gray-800"
								>
									私密房间
								</Label>
							</div>

							{isPrivate && (
								<div className="space-y-2">
									<Label htmlFor="password" className="text-sm text-gray-600">
										房间密码
									</Label>
									<Input
										id="password"
										type="password"
										placeholder="输入房间密码"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										required
									/>
								</div>
							)}
						</div>
					</div>

					{/* 底部操作栏 */}
					<div className="flex gap-3 border-t bg-gray-50/50 p-6">
						<Button
							variant="outline"
							onClick={() => navigate('/room/guess-draw')}
							className="flex-1 bg-white hover:bg-gray-100"
						>
							<ArrowLeft className="mr-2 h-4 w-4" />
							取消
						</Button>
						<Button
							onClick={handleCreateRoom}
							disabled={isCreating}
							className="flex-2 bg-black text-white hover:bg-gray-800"
						>
							{isCreating ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									创建中...
								</>
							) : (
								<>
									<Plus className="mr-2 h-4 w-4" />
									立即创建
								</>
							)}
						</Button>
					</div>
				</div>

				{/* 底部提示 */}
				<div className="mt-6 flex justify-center gap-6 text-xs text-gray-400">
					<div className="flex items-center gap-1">
						<Settings2 className="h-3 w-3" />
						<span>可随时调整</span>
					</div>
					<div className="flex items-center gap-1">
						<Users className="h-3 w-3" />
						<span>支持多人观战</span>
					</div>
				</div>
			</div>
		</div>
	);
}
