import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
// import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
// import {
// 	Select,
// 	SelectContent,
// 	SelectItem,
// 	SelectTrigger,
// 	SelectValue,
// } from '@/components/ui/select';
import {
	AlertDialog,
	AlertDialogClose,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogPopup,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
	ArrowLeft,
	// Moon,
	// Sun,
	// Globe,
	Palette,
	User,
	// Bell,
	Shield,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { SetTitle } from '@/utils/set-title';
import { authApi } from '@/api/auth';
import { toast } from 'sonner';

export function SettingsPage() {
	const navigate = useNavigate();
	const { user, setUser } = useAuth();

	// 设置状态，从 localStorage 初始化
	// const [darkMode, setDarkMode] = useState(
	// 	() => localStorage.getItem('darkMode') === 'true'
	// );
	// const [language, setLanguage] = useState(
	// 	() => localStorage.getItem('language') || 'zh-CN'
	// );
	// const [notifications, setNotifications] = useState(
	// 	() => localStorage.getItem('notifications') !== 'false'
	// );
	// const [autoSave, setAutoSave] = useState(
	// 	() => localStorage.getItem('autoSave') !== 'false'
	// );

	// 用户资料修改状态
	const [showUsernameDialog, setShowUsernameDialog] = useState(false);
	const [showPasswordDialog, setShowPasswordDialog] = useState(false);
	const [newUsername, setNewUsername] = useState(user?.name || '');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [isUpdating, setIsUpdating] = useState(false);

	// 应用暗色模式
	// useEffect(() => {
	// 	if (darkMode) {
	// 		document.documentElement.classList.add('dark');
	// 	} else {
	// 		document.documentElement.classList.remove('dark');
	// 	}
	// }, [darkMode]);

	// // 处理暗色模式切换
	// const handleDarkModeChange = (checked: boolean) => {
	// 	setDarkMode(checked);
	// 	localStorage.setItem('darkMode', checked.toString());
	// };

	// // 处理语言切换
	// const handleLanguageChange = (value: string) => {
	// 	setLanguage(value);
	// 	localStorage.setItem('language', value);
	// 	// 这里可以添加语言切换逻辑
	// };

	// // 处理通知切换
	// const handleNotificationsChange = (checked: boolean) => {
	// 	setNotifications(checked);
	// 	localStorage.setItem('notifications', checked.toString());
	// };

	// // 处理自动保存切换
	// const handleAutoSaveChange = (checked: boolean) => {
	// 	setAutoSave(checked);
	// 	localStorage.setItem('autoSave', checked.toString());
	// };

	// 处理用户名修改
	const handleUpdateUsername = async () => {
		if (!newUsername.trim()) {
			toast.error('用户名不能为空');
			return;
		}

		if (newUsername === user?.name) {
			toast.error('新用户名不能与当前用户名相同');
			return;
		}

		setIsUpdating(true);
		try {
			const response = await authApi.updateProfile({
				username: newUsername.trim(),
			});
			if (response.data?.success) {
				toast.success('用户名修改成功');
				// 立即更新本地用户状态以实现实时显示
				setUser((prev) =>
					prev ? { ...prev, name: newUsername.trim() } : null
				);
				setShowUsernameDialog(false);
				setNewUsername('');
			} else {
				toast.error(response.error?.value?.message || '修改失败');
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : '修改失败，请重试');
		} finally {
			setIsUpdating(false);
		}
	};

	// 处理密码修改
	const handleUpdatePassword = async () => {
		if (!newPassword) {
			toast.error('请输入新密码');
			return;
		}

		if (newPassword !== confirmPassword) {
			toast.error('两次输入的密码不一致');
			return;
		}

		if (newPassword.length < 6) {
			toast.error('密码长度至少为6位');
			return;
		}

		setIsUpdating(true);
		try {
			const response = await authApi.updateProfile({ password: newPassword });
			if (response.data?.success) {
				toast.success('密码修改成功');
				setShowPasswordDialog(false);
				setNewPassword('');
				setConfirmPassword('');
			} else {
				toast.error(response.error?.value?.message || '修改失败');
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : '修改失败，请重试');
		} finally {
			setIsUpdating(false);
		}
	};

	// 取消编辑
	const handleCancelEdit = () => {
		setShowUsernameDialog(false);
		setShowPasswordDialog(false);
		setNewUsername(user?.name || '');
		setNewPassword('');
		setConfirmPassword('');
	};

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900">
			<SetTitle title="设置" />

			{/* 顶部导航栏 */}
			<header className="sticky top-0 z-10 border-b bg-white px-4 py-3 sm:px-6 lg:px-8 dark:bg-gray-800">
				<div className="mx-auto flex max-w-7xl items-center justify-between">
					<div className="flex items-center gap-4">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => navigate('/room')}
							className="text-gray-600 dark:text-gray-400"
						>
							<ArrowLeft className="mr-1 h-4 w-4" /> 返回大厅
						</Button>
						<div className="flex items-center gap-2 border-l pl-4">
							<Palette className="h-5 w-5 text-gray-900 dark:text-gray-100" />
							<h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
								设置
							</h1>
						</div>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
				<div className="space-y-8">
					{/* 外观设置 */}
					{/* <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
						<div className="mb-4">
							<h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
								<Palette className="h-5 w-5" />
								外观设置
							</h3>
							<p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
								自定义应用的外观和显示方式
							</p>
						</div>
						<div className="space-y-6">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<Label className="text-base">暗色模式</Label>
									<p className="text-muted-foreground text-sm">
										切换深色或浅色主题
									</p>
								</div>
								<div className="flex items-center gap-2">
									<Sun className="h-4 w-4 text-yellow-500" />
									<Switch
										checked={darkMode}
										onCheckedChange={handleDarkModeChange}
									/>
									<Moon className="h-4 w-4 text-blue-500" />
								</div>
							</div>

							<Separator />

							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<Label className="text-base">语言</Label>
									<p className="text-muted-foreground text-sm">
										选择应用显示语言
									</p>
								</div>
								<Select value={language} onValueChange={handleLanguageChange}>
									<SelectTrigger className="w-32">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="zh-CN">
											<div className="flex items-center gap-2">
												<Globe className="h-4 w-4" />
												中文
											</div>
										</SelectItem>
										<SelectItem value="en-US">
											<div className="flex items-center gap-2">
												<Globe className="h-4 w-4" />
												English
											</div>
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
					</div> */}

					{/* 通知设置 */}
					{/* <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
						<div className="mb-4">
							<h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
								<Bell className="h-5 w-5" />
								通知设置
							</h3>
							<p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
								管理通知和提醒偏好
							</p>
						</div>
						<div className="space-y-6">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<Label className="text-base">推送通知</Label>
									<p className="text-muted-foreground text-sm">
										接收游戏邀请和系统通知
									</p>
								</div>
								<Switch
									checked={notifications}
									onCheckedChange={handleNotificationsChange}
								/>
							</div>
						</div>
					</div> */}

					{/* 白板设置 */}
					{/* <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
						<div className="mb-4">
							<h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
								<Palette className="h-5 w-5" />
								白板设置
							</h3>
							<p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
								配置白板的行为和功能
							</p>
						</div>
						<div className="space-y-6">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<Label className="text-base">自动保存</Label>
									<p className="text-muted-foreground text-sm">
										自动保存白板内容到本地
									</p>
								</div>
								<Switch
									checked={autoSave}
									onCheckedChange={handleAutoSaveChange}
								/>
							</div>
						</div>
					</div> */}

					{/* 账户设置 */}
					{user && (
						<div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
							<div className="mb-4">
								<h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
									<User className="h-5 w-5" />
									账户设置
								</h3>
								<p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
									管理您的账户信息
								</p>
							</div>
							<div className="space-y-6">
								{/* 用户名设置 */}
								<div className="flex items-center justify-between">
									<div className="space-y-0.5">
										<Label className="text-base">用户名</Label>
										<p className="text-muted-foreground text-sm">{user.name}</p>
									</div>
									<Button
										variant="outline"
										size="sm"
										onClick={() => setShowUsernameDialog(true)}
									>
										编辑
									</Button>
								</div>

								<Separator />

								{/* 密码设置 */}
								<div className="flex items-center justify-between">
									<div className="space-y-0.5">
										<Label className="text-base">密码</Label>
										<p className="text-muted-foreground text-sm">••••••••</p>
									</div>
									<Button
										variant="outline"
										size="sm"
										onClick={() => setShowPasswordDialog(true)}
									>
										更改
									</Button>
								</div>
							</div>
						</div>
					)}

					{/* 隐私与安全 */}
					<div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
						<div className="mb-4">
							<h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
								<Shield className="h-5 w-5" />
								隐私与安全
							</h3>
							<p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
								保护您的隐私和账户安全
							</p>
						</div>
						<div className="space-y-6">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<Label className="text-base">数据隐私</Label>
									<p className="text-muted-foreground text-sm">
										管理您的个人数据和隐私设置
									</p>
								</div>
								<Button disabled variant="outline" size="sm">
									查看
								</Button>
							</div>
						</div>
					</div>
				</div>
			</main>

			{/* 用户名编辑对话框 */}
			<AlertDialog
				open={showUsernameDialog}
				onOpenChange={setShowUsernameDialog}
			>
				<AlertDialogPopup>
					<AlertDialogHeader>
						<AlertDialogTitle>编辑用户名</AlertDialogTitle>
						<AlertDialogDescription>
							输入您的新用户名，用户名必须唯一且不能为空。
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div className="space-y-4 px-6 py-4">
						<div>
							<Label htmlFor="username">新用户名</Label>
							<Input
								id="username"
								value={newUsername}
								onChange={(e) => setNewUsername(e.target.value)}
								placeholder="输入新用户名"
								disabled={isUpdating}
							/>
						</div>
					</div>
					<AlertDialogFooter>
						<AlertDialogClose onClick={handleCancelEdit} disabled={isUpdating}>
							<Button variant="outline">取消</Button>
						</AlertDialogClose>
						<Button onClick={handleUpdateUsername} disabled={isUpdating}>
							{isUpdating ? '保存中...' : '保存'}
						</Button>
					</AlertDialogFooter>
				</AlertDialogPopup>
			</AlertDialog>

			{/* 密码编辑对话框 */}
			<AlertDialog
				open={showPasswordDialog}
				onOpenChange={setShowPasswordDialog}
			>
				<AlertDialogPopup>
					<AlertDialogHeader>
						<AlertDialogTitle>更改密码</AlertDialogTitle>
						<AlertDialogDescription>
							输入您的新密码，密码长度至少为6位。
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div className="space-y-4 px-6 py-4">
						<div>
							<Label htmlFor="newPassword">新密码</Label>
							<Input
								id="newPassword"
								type="password"
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								placeholder="输入新密码"
								disabled={isUpdating}
							/>
						</div>
						<div>
							<Label htmlFor="confirmPassword">确认密码</Label>
							<Input
								id="confirmPassword"
								type="password"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								placeholder="再次输入新密码"
								disabled={isUpdating}
							/>
						</div>
					</div>
					<AlertDialogFooter>
						<AlertDialogClose onClick={handleCancelEdit} disabled={isUpdating}>
							<Button variant="outline">取消</Button>
						</AlertDialogClose>
						<Button onClick={handleUpdatePassword} disabled={isUpdating}>
							{isUpdating ? '保存中...' : '保存'}
						</Button>
					</AlertDialogFooter>
				</AlertDialogPopup>
			</AlertDialog>
		</div>
	);
}
