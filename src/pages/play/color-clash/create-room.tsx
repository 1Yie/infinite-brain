import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { colorClashApi } from '@/api/color-clash';
import { toast } from 'sonner';
import {
	ArrowLeft,
	Gamepad2,
	Settings,
	Users,
	Clock,
	Plus,
} from 'lucide-react';

export function CreateColorClashRoom() {
	const navigate = useNavigate();
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [formData, setFormData] = useState({
		name: '',
		maxPlayers: 8,
		gameTime: 300, // 5分钟
		canvasWidth: 800,
		canvasHeight: 600,
		isPrivate: false,
		password: '',
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!formData.name.trim()) {
			toast.error('请输入房间名称');
			return;
		}

		if (formData.maxPlayers < 2 || formData.maxPlayers > 16) {
			toast.error('玩家数量必须在2-16之间');
			return;
		}

		if (formData.gameTime < 60 || formData.gameTime > 1800) {
			toast.error('游戏时长必须在1-30分钟之间');
			return;
		}

		if (formData.canvasWidth < 400 || formData.canvasWidth > 2000) {
			toast.error('画布宽度必须在400-2000之间');
			return;
		}

		if (formData.canvasHeight < 300 || formData.canvasHeight > 1500) {
			toast.error('画布高度必须在300-1500之间');
			return;
		}

		if (formData.isPrivate && !formData.password.trim()) {
			toast.error('私密房间必须设置密码');
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			const response = await colorClashApi.createRoom({
				name: formData.name.trim(),
				maxPlayers: formData.maxPlayers,
				gameTime: formData.gameTime,
				canvasWidth: formData.canvasWidth,
				canvasHeight: formData.canvasHeight,
				isPrivate: formData.isPrivate,
				password: formData.isPrivate ? formData.password.trim() : undefined,
			});

			if (response.success && response.data) {
				toast.success('房间创建成功');
				navigate(`/room/color-clash/${response.data.id}`);
			} else {
				const errorMessage = response.error?.message || '创建房间失败';
				setError(errorMessage);
				toast.error(errorMessage);
			}
		} catch (error) {
			console.error('创建房间失败:', error);
			const errorMessage = '创建房间失败，请稍后重试';
			setError(errorMessage);
			toast.error(errorMessage);
		} finally {
			setIsLoading(false);
		}
	};

	const handleInputChange = (
		field: string,
		value: string | number | boolean
	) => {
		setFormData((prev) => ({
			...prev,
			[field]: value,
		}));
	};

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
			<div className="animate-in fade-in zoom-in-95 w-full max-w-lg duration-300">
				{/* 头部标题 */}
				<div className="mb-6 text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-black text-white shadow-lg">
						<Gamepad2 className="h-6 w-6" />
					</div>
					<h1 className="text-2xl font-bold text-gray-900">创建颜色对抗房间</h1>
					<p className="mt-2 text-sm text-gray-500">
						自定义规则，开启一场精彩的颜色争夺战
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
						{/* 房间名称 */}
						<div className="space-y-3">
							<Label
								htmlFor="name"
								className="flex items-center gap-2 text-base font-semibold text-gray-800"
							>
								<Plus className="h-4 w-4 text-gray-500" />
								房间名称
							</Label>
							<Input
								id="name"
								type="text"
								placeholder="输入房间名称"
								value={formData.name}
								onChange={(e) => handleInputChange('name', e.target.value)}
								required
							/>
						</div>

						{/* 玩家数量 */}
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<Label
									htmlFor="maxPlayers"
									className="flex items-center gap-2 text-base font-semibold text-gray-800"
								>
									<Users className="h-4 w-4 text-gray-500" />
									最大玩家数
								</Label>
								<span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-sm font-bold text-gray-900">
									{formData.maxPlayers} 人
								</span>
							</div>
							<Input
								id="maxPlayers"
								type="number"
								min="2"
								max="16"
								value={formData.maxPlayers}
								onChange={(e) =>
									handleInputChange('maxPlayers', parseInt(e.target.value))
								}
								required
							/>
						</div>

						{/* 游戏时长 */}
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label
									htmlFor="gameTime"
									className="flex items-center gap-2 text-base font-semibold text-gray-800"
								>
									<Clock className="h-4 w-4 text-gray-500" />
									游戏时长
								</Label>
								<span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-sm font-bold text-gray-900">
									{Math.floor(formData.gameTime / 60)}分{formData.gameTime % 60}
									秒
								</span>
							</div>
							<Input
								id="gameTime"
								type="number"
								min="60"
								max="1800"
								value={formData.gameTime}
								onChange={(e) =>
									handleInputChange('gameTime', parseInt(e.target.value))
								}
								required
							/>
						</div>

						{/* 画布尺寸 */}
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label className="flex items-center gap-2 text-base font-semibold text-gray-800">
									<Gamepad2 className="h-4 w-4 text-gray-500" />
									画布尺寸
								</Label>
								<span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-sm font-bold text-gray-900">
									{formData.canvasWidth} × {formData.canvasHeight}
								</span>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label
										htmlFor="canvasWidth"
										className="text-sm text-gray-600"
									>
										宽度
									</Label>
									<Input
										id="canvasWidth"
										type="number"
										min="400"
										max="2000"
										value={formData.canvasWidth}
										onChange={(e) =>
											handleInputChange('canvasWidth', parseInt(e.target.value))
										}
										required
									/>
								</div>
								<div>
									<Label
										htmlFor="canvasHeight"
										className="text-sm text-gray-600"
									>
										高度
									</Label>
									<Input
										id="canvasHeight"
										type="number"
										min="300"
										max="1500"
										value={formData.canvasHeight}
										onChange={(e) =>
											handleInputChange(
												'canvasHeight',
												parseInt(e.target.value)
											)
										}
										required
									/>
								</div>
							</div>
						</div>

						{/* 私密房间设置 */}
						<div className="space-y-3">
							<div className="flex items-center space-x-2">
								<Checkbox
									id="isPrivate"
									checked={formData.isPrivate}
									onCheckedChange={(checked) =>
										handleInputChange('isPrivate', !!checked)
									}
								/>
								<Label
									htmlFor="isPrivate"
									className="text-base font-semibold text-gray-800"
								>
									私密房间
								</Label>
							</div>

							{formData.isPrivate && (
								<div className="space-y-2">
									<Label htmlFor="password" className="text-sm text-gray-600">
										房间密码
									</Label>
									<Input
										id="password"
										type="password"
										placeholder="输入房间密码"
										value={formData.password}
										onChange={(e) =>
											handleInputChange('password', e.target.value)
										}
										required
									/>
								</div>
							)}
						</div>
					</div>

					{/* 底部操作栏 */}
					<div className="flex gap-3 border-t bg-gray-50/50 p-6">
						<Button
							type="button"
							variant="outline"
							className="flex-1 bg-white hover:bg-gray-100"
							onClick={() => navigate('/room/color-clash')}
						>
							<ArrowLeft className="mr-2 h-4 w-4" />
							取消
						</Button>
						<Button
							onClick={handleSubmit}
							className="flex-1 bg-black text-white hover:bg-gray-800"
							disabled={isLoading}
						>
							{isLoading ? '创建中...' : '创建房间'}
						</Button>
					</div>
				</div>

				{/* 底部提示 */}
				<div className="mt-6 flex justify-center gap-6 text-xs text-gray-400">
					<div className="flex items-center gap-1">
						<Settings className="h-3 w-3" />
						<span>可随时调整规则</span>
					</div>
					<div className="flex items-center gap-1">
						<Users className="h-3 w-3" />
						<span>支持多人竞技</span>
					</div>
				</div>
			</div>
		</div>
	);
}
