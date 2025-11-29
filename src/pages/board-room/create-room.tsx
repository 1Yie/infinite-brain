import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { roomApi } from '@/api/room';
import { SetTitle } from '@/utils/set-title';
import { ArrowLeft, Plus, Loader2, Pencil, Lock, Users } from 'lucide-react';

export function CreateWhiteboardRoom() {
	const navigate = useNavigate();
	const [isCreating, setIsCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [formData, setFormData] = useState({
		name: '',
		isPrivate: false,
		password: '',
	});

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (!formData.name.trim()) {
			setError('请输入房间名称');
			return;
		}

		if (formData.isPrivate && !formData.password.trim()) {
			setError('私密房间必须设置密码');
			return;
		}

		setIsCreating(true);

		try {
			const response = await roomApi.createRoom(
				formData.name.trim(),
				formData.isPrivate,
				formData.isPrivate ? formData.password.trim() : undefined
			);

			if (response.roomId) {
				// 如果是创建者，设置房间授权状态，避免跳转后还要输入密码
				if (formData.isPrivate) {
					sessionStorage.setItem(`room_auth_${response.roomId}`, 'true');
				}
				navigate(`/room/whiteboard/${response.roomId}`);
			} else {
				setError('创建房间失败');
			}
		} catch (error) {
			console.error('创建房间失败:', error);
			setError('创建房间失败，请稍后重试');
		} finally {
			setIsCreating(false);
		}
	};

	const handleInputChange = (field: string, value: string | boolean) => {
		setFormData((prev) => ({
			...prev,
			[field]: value,
		}));
	};

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
			<SetTitle title="创建白板房间" />

			<div className="animate-in fade-in zoom-in-95 w-full max-w-lg duration-300">
				{/* 头部标题 */}
				<div className="mb-6 text-center">
					<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-black text-white shadow-lg">
						<Pencil className="h-6 w-6" />
					</div>
					<h1 className="text-2xl font-bold text-gray-900">创建白板房间</h1>
					<p className="mt-2 text-sm text-gray-500">
						创建一个协作空间，与朋友一起绘制创意
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

					<div className="space-y-6 p-6 md:p-8">
						{/* 房间名称 */}
						<div className="space-y-2">
							<Label
								htmlFor="name"
								className="flex items-center gap-2 text-base font-semibold text-gray-800"
							>
								<Pencil className="h-4 w-4 text-gray-500" />
								房间名称
							</Label>
							<div className="mt-2">
								<Input
									id="name"
									type="text"
									value={formData.name}
									onChange={(e) => handleInputChange('name', e.target.value)}
									placeholder="输入房间名称"
									className="w-full"
								/>
							</div>
						</div>

						{/* 分割线 */}
						<div className="h-px w-full bg-gray-100" />

						{/* 私密设置 */}
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<Label
									htmlFor="isPrivate"
									className="flex items-center gap-2 text-base font-semibold text-gray-800"
								>
									<Lock className="h-4 w-4 text-gray-500" />
									隐私设置
								</Label>
							</div>

							<div className="flex items-center space-x-3">
								<Checkbox
									id="isPrivate"
									checked={formData.isPrivate}
									onCheckedChange={(checked) =>
										handleInputChange('isPrivate', !!checked)
									}
									className="h-5 w-5 rounded-sm"
								/>
								<label
									htmlFor="isPrivate"
									className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
								>
									设为私密房间
								</label>
							</div>

							{formData.isPrivate && (
								<div className="mt-2">
									<Label
										htmlFor="password"
										className="text-sm font-medium text-gray-700"
									>
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
										className="mt-1"
										required
									/>
									<p className="mt-1 text-xs text-gray-500">
										只有知道密码的用户才能加入此房间
									</p>
								</div>
							)}
						</div>
					</div>

					{/* 底部操作栏 */}
					<div className="flex gap-3 border-t bg-gray-50/50 p-6">
						<Button
							variant="outline"
							onClick={() => navigate('/room/whiteboard')}
							className="flex-1 bg-white hover:bg-gray-100"
						>
							<ArrowLeft className="mr-2 h-4 w-4" />
							取消
						</Button>
						<Button
							onClick={handleSubmit}
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
						<Users className="h-3 w-3" />
						<span>支持多人协作</span>
					</div>
				</div>
			</div>
		</div>
	);
}
