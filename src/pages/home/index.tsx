import { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { WhiteboardCanvas } from '../board-room/white-board/whiteboard-canvas';
import { WhiteboardToolbar } from '../board-room/white-board/whiteboard-toolbar';
import type {
	WhiteboardCanvasHandle,
	DrawData,
} from '../board-room/white-board/whiteboard-canvas';
import { useBoardWebSocket } from '../../hooks/use-board-websocket';
import type { StrokeData } from '../../types/whiteboard';
import { DynamicIcon } from 'lucide-react/dynamic';
import { authApi } from '../../api/auth';
import { Button } from '../../components/ui/button';
import {
	Brain,
	Pencil,
	Clock,
	CircleUser,
	MessageSquare,
	Send,
	Gamepad2,
	Users,
} from 'lucide-react';
import TextType from '@/components/TextType';
import AnimatedContent from '@/components/AnimatedContent';
import FadeContent from '@/components/FadeContent';

function FeatureCard({
	icon: Icon,
	title,
	desc,
}: {
	icon: Parameters<typeof DynamicIcon>[0]['name'];
	title: string;
	desc: string;
}) {
	return (
		<div className="group flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 transition-all duration-300 hover:border-zinc-400 hover:bg-zinc-50">
			<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 text-zinc-900 transition-colors group-hover:bg-zinc-900 group-hover:text-white">
				<DynamicIcon name={Icon} size={24} />
			</div>
			<div>
				<h3 className="mb-2 text-lg font-bold text-zinc-900">{title}</h3>
				<p className="text-sm leading-relaxed text-zinc-500">{desc}</p>
			</div>
		</div>
	);
}

export function HomePage() {
	const navigate = useNavigate();
	const roomId = 'default-room'; // 默认演示房间
	const canvasRef = useRef<WhiteboardCanvasHandle>(null);

	// 锚点 Ref 用于计算何时吸顶
	const triggerRef = useRef<HTMLDivElement>(null);

	// 白板状态
	const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
	const [color, setColor] = useState('#000000');
	const [size, setSize] = useState(4);

	// UI 状态
	const [isSticky, setIsSticky] = useState(false);
	const [isLogged, setIsLogged] = useState<boolean | null>(null);
	const [currentSlide, setCurrentSlide] = useState(0); // 0: 白板演示, 1: 你猜我画, 2: 颜色对抗
	const [currentAnnouncement, setCurrentAnnouncement] = useState(0); // 滚动公告索引

	// WebSocket - 允许未登录用户也能连接，使用游客身份
	const {
		isConnected,
		userId,
		onMessage,
		sendDraw,
		sendStrokeFinish,
		sendUndo,
		sendRedo,
	} = useBoardWebSocket(true, roomId); // 允许游客使用撤销/重做功能

	// 监听 WebSocket
	useEffect(() => {
		const unsubscribe = onMessage((msg) => {
			if (!canvasRef.current) return;
			if (msg.type === 'draw' && msg.userId !== userId) {
				canvasRef.current.drawRemote(msg.data as DrawData);
			}
			if (msg.type === 'clear') canvasRef.current.clear();
			if (msg.type === 'history-sync')
				canvasRef.current.syncHistory(msg.data as StrokeData[]);
			if (msg.type === 'undo') {
				// 处理撤销消息：根据服务器广播的 strokeId 删除指定笔画
				if (msg.strokeId) {
					console.log(
						`收到撤销消息，删除笔画ID: ${msg.strokeId}, 用户ID: ${msg.userId}`
					);
					canvasRef.current?.removeStrokeById(msg.strokeId);
				} else {
					console.log('收到撤销消息，但没有可撤销的笔画');
				}
			}
			if (msg.type === 'redo') {
				// 处理重做消息：添加服务器广播的笔画数据
				console.log(
					`收到重做消息，笔画ID: ${msg.data?.id}, 用户ID: ${msg.userId}`
				);
				if (msg.data) {
					canvasRef.current?.addStroke(msg.data as StrokeData);
				}
			}
		});
		return () => unsubscribe();
	}, [userId, onMessage]);

	const handleFinish = useCallback(
		(stroke: StrokeData) => {
			if (!isConnected) return;
			// 直接传递笔画数据，不生成新的ID
			sendStrokeFinish({
				...stroke,
				createdAt: stroke.createdAt || new Date(),
			});
		},
		[isConnected, sendStrokeFinish]
	);

	const handleUndo = useCallback(() => {
		if (!isConnected) return;

		// 首页演示：撤销最新的笔画（不区分用户）
		const strokeId = canvasRef.current?.undo();
		// 发送撤销请求给后端
		if (strokeId) {
			sendUndo(strokeId);
		} else {
			sendUndo();
		}
	}, [isConnected, sendUndo]);

	const handleRedo = useCallback(() => {
		if (!isConnected) return;

		// 本地重做
		const strokeToRedo = canvasRef.current?.redo();
		if (strokeToRedo) {
			// 发送重做的数据给服务器，广播给其他用户
			sendRedo(strokeToRedo);
		}
	}, [isConnected, sendRedo]);

	// 滚动监听
	useEffect(() => {
		const handleScroll = () => {
			if (!triggerRef.current) return;
			const rect = triggerRef.current.getBoundingClientRect();
			// 当触发点滚出视口顶部时，显示吸顶导航
			setIsSticky(rect.bottom < 80);
		};
		window.addEventListener('scroll', handleScroll, { passive: true });
		return () => window.removeEventListener('scroll', handleScroll);
	}, []);

	// 检查登录状态
	useEffect(() => {
		authApi
			.checkAuth()
			.then((res) => {
				setIsLogged(res?.success || false);
			})
			.catch(() => {
				setIsLogged(false);
			});
	}, []);

	// 公告滚动定时器
	useEffect(() => {
		const interval = setInterval(() => {
			setCurrentAnnouncement((prev) => (prev + 1) % 2); // 在公告之间切换
		}, 8000);

		return () => clearInterval(interval);
	}, []);

	// 首页白板：在页面隐藏/卸载时保存当前视图状态（仅localStorage，演示用途）
	useEffect(() => {
		const key = `whiteboard-view-state-${roomId}`;
		const canvasRefCurrent = canvasRef.current;

		const saveLocal = () => {
			try {
				const vs = canvasRefCurrent?.getViewState();
				if (vs) {
					localStorage.setItem(key, JSON.stringify(vs));
				}
			} catch (e) {
				console.warn('保存首页视图到localStorage失败:', e);
			}
		};

		const handleBeforeUnload = () => saveLocal();
		const handleVisibility = () => {
			if (document.visibilityState === 'hidden') saveLocal();
		};

		window.addEventListener('beforeunload', handleBeforeUnload);
		document.addEventListener('visibilitychange', handleVisibility);

		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
			document.removeEventListener('visibilitychange', handleVisibility);

			// 组件卸载时保存到localStorage
			const vs = canvasRefCurrent?.getViewState();
			if (vs) {
				try {
					localStorage.setItem(key, JSON.stringify(vs));
				} catch (e) {
					console.log('error: ', e);
				}
			}
		};
	}, [roomId]);

	return (
		<div className="min-h-screen w-full bg-white font-sans text-zinc-900 selection:bg-zinc-900 selection:text-white">
			{/* 吸顶导航栏 */}
			<header
				className={`fixed top-0 right-0 left-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur-md transition-transform duration-300 ease-in-out ${
					isSticky ? 'translate-y-0' : '-translate-y-full'
				}`}
			>
				<div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
					<div className="flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2">
						<Brain className="h-6 w-6" />
						<span className="text-lg font-bold tracking-tight">
							Infinite Brain
						</span>
					</div>
					<div className="flex items-center gap-4">
						{isLogged === true ? (
							<Button
								onClick={() => navigate('/room')}
								className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-zinc-800 active:scale-95"
							>
								前往房间
							</Button>
						) : (
							<>
								<Button
									variant="ghost"
									onClick={() => navigate('/login')}
									className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
								>
									登录
								</Button>
								<Button
									onClick={() => navigate('/register')}
									className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-zinc-800 active:scale-95"
								>
									免费注册
								</Button>
							</>
						)}
					</div>
				</div>
			</header>

			{/* Hero 区域：白板演示 */}
			<section
				data-demo-section
				className="relative flex min-h-[90vh] flex-col pt-10 pb-16"
			>
				<div className="mx-auto mb-6 max-w-3xl px-6 text-center">
					<div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
						<span className="relative flex h-2 w-2">
							<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
							<span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
						</span>
						<FadeContent
							key={currentAnnouncement}
							blur={true}
							duration={650}
							easing="ease-out"
							initialOpacity={0}
						>
							<span
								className="cursor-pointer transition-all duration-500"
								onClick={() => {
									if (currentAnnouncement === 0) {
										navigate('/room/guess-draw');
									} else {
										navigate('/room/color-clash');
									}
								}}
							>
								{currentAnnouncement === 0
									? '《你猜我画》现已上线！立刻体验 →'
									: '全新上线《颜色对抗》！立刻尝试 →'}
							</span>
						</FadeContent>
					</div>
					<h1 className="mb-4 text-2xl font-extrabold tracking-tight text-zinc-600 sm:text-4xl">
						Infinite Brain
					</h1>
					<h1 className="text-3xl font-extrabold tracking-tight text-zinc-800 sm:text-5xl">
						让创意{' '}
						<TextType
							text={[
								'永无止境',
								'不再受限',
								'无限进步',
								'点亮未来',
								'突破想象的边界',
								'像光一样扩散',
								'把灵感变成现实',
							]}
							className="bg-linear-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent"
							typingSpeed={175}
							deletingSpeed={130}
							pauseDuration={2300}
							showCursor={true}
							cursorCharacter="|"
						/>
					</h1>
				</div>

				{/* 轮播切换按钮 */}
				<div className="mx-auto mb-6 flex max-w-md items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white p-1 shadow-sm">
					<button
						onClick={() => setCurrentSlide(0)}
						className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
							currentSlide === 0
								? 'bg-zinc-900 text-white shadow-sm'
								: 'text-zinc-600 hover:text-zinc-900'
						}`}
					>
						无限画布
					</button>
					<button
						onClick={() => setCurrentSlide(1)}
						className={`relative flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
							currentSlide === 1
								? 'bg-zinc-900 text-white shadow-sm'
								: 'text-zinc-600 hover:text-zinc-900'
						}`}
					>
						你猜我画
						{currentSlide !== 1 && (
							<span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500"></span>
						)}
					</button>
					<button
						onClick={() => setCurrentSlide(2)}
						className={`relative flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
							currentSlide === 2
								? 'bg-zinc-900 text-white shadow-sm'
								: 'text-zinc-600 hover:text-zinc-900'
						}`}
					>
						颜色对抗
						{currentSlide !== 2 && (
							<span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-500"></span>
						)}
					</button>
				</div>

				{/* 统一的吸顶导航触发点 */}
				<div
					ref={triggerRef}
					className="absolute top-full right-0 left-0 h-1"
				></div>

				<AnimatedContent
					distance={150}
					direction="vertical"
					reverse={false}
					duration={1}
					ease="power3.out"
				>
					{/* 白板容器 */}
					<div className="relative mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6">
						{/* 白板演示 */}
						<div
							className={`relative h-[500px] overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 shadow-sm ${currentSlide === 0 ? 'block' : 'hidden'}`}
						>
							{/* 装饰性网格背景 */}
							<div
								className="pointer-events-none absolute inset-0 opacity-[0.4]"
								style={{
									backgroundImage:
										'radial-gradient(#cbd5e1 1px, transparent 1px)',
									backgroundSize: '24px 24px',
								}}
							></div>

							<WhiteboardCanvas
								ref={canvasRef}
								tool={tool}
								color={color}
								size={size}
								roomId={roomId}
								readOnly={!isConnected}
								onStrokeFinished={handleFinish}
								onRealtimeDraw={sendDraw}
							/>

							{/* 连接状态提示 */}
							{!isConnected && (
								<div className="absolute top-4 right-4 flex items-center gap-2 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-medium text-yellow-800">
									<div className="h-2 w-2 animate-pulse rounded-full bg-yellow-500"></div>
									正在连接服务器...
								</div>
							)}

							{/* 工具栏位置 */}
							<div className="absolute right-0 bottom-0 left-0">
								<div className="bordershadow-lg rounded-xl backdrop-blur supports-backdrop-filter:bg-white/60">
									<WhiteboardToolbar
										currentTool={tool}
										setCurrentTool={setTool}
										handleUndo={handleUndo}
										handleRedo={handleRedo}
										currentColor={color}
										setCurrentColor={setColor}
										currentSize={size}
										setCurrentSize={setSize}
										isConnected={isConnected}
									/>
								</div>
							</div>
						</div>

						{/* 你猜我画演示 */}
						<div
							className={`relative h-[500px] overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 shadow-sm ${currentSlide === 1 ? 'block' : 'hidden'}`}
						>
							{/* 你猜我画布局 - 参考真实页面 */}
							<div className="flex h-full gap-4 p-4">
								{/* 左侧边栏 - 状态面板 */}
								<div className="hidden w-64 flex-col gap-4 xl:flex">
									{/* 状态面板 */}
									<div className="flex flex-none flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
										<div className="flex h-10 flex-none items-center justify-between border-b border-zinc-100 bg-zinc-50 px-3">
											<h3 className="flex items-center gap-2 text-xs font-semibold text-zinc-700">
												状态
											</h3>
										</div>
										<div className="p-3">
											<div className="space-y-3">
												<div className="rounded border border-slate-100 bg-slate-50 p-2 text-center">
													<p className="text-xs text-zinc-500">等待开始</p>
													<p className="mt-1 text-[10px] text-zinc-400">
														需至少2人
													</p>
												</div>
												<div className="text-center">
													<span className="font-mono text-2xl font-bold text-zinc-800">
														45
													</span>
													<span className="mt-1 block text-[10px] text-zinc-400">
														剩余时间
													</span>
												</div>
												<div className="rounded border border-blue-100 bg-blue-50 p-2 text-center">
													<div className="mb-1 text-[10px] text-zinc-400">
														提示
													</div>
													<div className="font-mono text-sm tracking-widest text-zinc-800">
														_ _ _ _
													</div>
												</div>
											</div>
										</div>
									</div>

									{/* 玩家列表 */}
									<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
										<div className="flex h-10 flex-none items-center justify-between border-b border-zinc-100 bg-zinc-50 px-3">
											<h3 className="flex items-center gap-2 text-xs font-semibold text-zinc-700">
												排行榜
											</h3>
										</div>
										<div className="flex-1 space-y-1 overflow-y-auto p-2">
											{[
												{ name: '玩家A', score: 150, isDrawing: false },
												{ name: '玩家B', score: 120, isDrawing: true },
												{ name: '玩家C', score: 90, isDrawing: false },
											].map((player, idx) => (
												<div
													key={idx}
													className={`flex items-center justify-between rounded p-2 text-xs transition-colors ${
														player.isDrawing
															? 'border border-blue-100 bg-blue-50'
															: 'border border-transparent hover:bg-zinc-50'
													}`}
												>
													<div className="flex min-w-0 items-center gap-2">
														<div className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
															<CircleUser className="h-4 w-4" />
														</div>
														<div className="flex min-w-0 flex-col">
															<span className="truncate text-xs font-medium text-zinc-600">
																{player.name}
															</span>
															{player.isDrawing && (
																<span className="flex items-center gap-1 text-[9px] text-blue-500">
																	<Pencil className="h-3 w-3" /> 正在画
																</span>
															)}
														</div>
													</div>
													<div className="text-right">
														<div className="font-mono font-bold text-zinc-700">
															{player.score}
														</div>
													</div>
												</div>
											))}
										</div>
									</div>
								</div>

								{/* 中间：画布区域 */}
								<div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
									<div className="flex h-10 flex-none items-center justify-between border-b border-zinc-100 bg-zinc-50 px-3">
										<div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
											<Pencil className="h-4 w-4" /> 画布
										</div>
									</div>
									<div className="relative flex-1 cursor-crosshair overflow-hidden bg-white">
										<div className="absolute inset-0 flex items-center justify-center">
											<div className="text-center">
												<Clock className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
												<h3 className="text-sm font-semibold text-zinc-900">
													画板区域
												</h3>
												<p className="text-xs text-zinc-500">等待游戏开始</p>
											</div>
										</div>
									</div>
								</div>

								{/* 右侧：聊天区域 */}
								<div className="hidden w-80 flex-none flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm lg:flex">
									<div className="flex h-10 flex-none items-center justify-between border-b border-zinc-100 bg-zinc-50 px-3">
										<h3 className="flex items-center gap-2 text-xs font-semibold text-zinc-700">
											<MessageSquare className="h-4 w-4" /> 消息
										</h3>
									</div>
									<div className="flex-1 space-y-2 overflow-y-auto bg-white p-3">
										<div className="flex flex-col items-center">
											<span className="my-1 rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[9px] text-zinc-500">
												游戏开始！
											</span>
										</div>
										<div className="flex flex-col items-start">
											<span className="mb-0.5 px-1 text-[9px] text-zinc-400">
												玩家A
											</span>
											<div className="max-w-[90%] rounded-2xl rounded-tl-none bg-zinc-100 px-2 py-1 text-[10px] text-zinc-800">
												这是一只猫？
											</div>
										</div>
										<div className="flex flex-col items-start">
											<span className="mb-0.5 px-1 text-[9px] text-zinc-400">
												玩家B
											</span>
											<div className="max-w-[90%] rounded-2xl rounded-tl-none bg-zinc-100 px-2 py-1 text-[10px] text-zinc-800">
												不对，再猜猜
											</div>
										</div>
										<div className="flex flex-col items-center">
											<span className="my-1 rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[9px] text-zinc-500">
												游戏结束！
											</span>
										</div>
										<div className="flex flex-col items-center">
											<span className="my-1 rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[9px] text-zinc-500">
												玩家A 获胜！🎉
											</span>
										</div>
									</div>
									<div className="flex-none border-t border-zinc-100 bg-zinc-50 p-2">
										<div className="relative">
											<input
												type="text"
												placeholder="输入答案..."
												className="h-7 w-full rounded border border-zinc-200 bg-white px-2 pr-8 text-xs focus:border-zinc-400 focus:outline-none"
												disabled
											/>
											<button className="absolute top-1 right-1 p-0.5 text-zinc-400 disabled:opacity-30">
												<Send className="h-4 w-4" />
											</button>
										</div>
										<div className="mt-1 text-center text-[9px] text-zinc-400">
											直接输入答案即可提交
										</div>
									</div>
								</div>
							</div>

							{/* 统一的触发点 - 用于吸顶导航 */}
							<div className="absolute right-0 bottom-0 left-0">
								<div className="h-12"></div>
							</div>
						</div>

						{/* 颜色对抗演示 */}
						<div
							className={`relative h-[500px] overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 shadow-sm ${currentSlide === 2 ? 'block' : 'hidden'}`}
						>
							{/* 颜色对抗布局 - 画布占满，右上角玩家列表 */}
							<div className="relative h-full w-full overflow-hidden rounded-2xl bg-white">
								{/* 网格背景 */}
								<div
									className="absolute inset-0 opacity-[0.3]"
									style={{
										backgroundImage:
											'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.05) 10px, rgba(0,0,0,0.05) 20px)',
									}}
								/>

								{/* 画布内容区域 */}
								<div className="absolute inset-0 flex items-center justify-center">
									<div className="text-center">
										<Gamepad2 className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
										<h3 className="text-sm font-semibold text-zinc-900">
											等待游戏开始
										</h3>

										<p className="mt-2 text-xs text-zinc-400">
											用键盘 WASD 或方向键移动，占领领土！
										</p>
									</div>
								</div>

								{/* 模拟玩家位置指示器 */}
								<div className="absolute top-8 left-8 h-3 w-3 rounded-full bg-red-500 shadow-lg"></div>
								<div className="absolute top-12 right-12 h-3 w-3 rounded-full bg-green-500 shadow-lg"></div>
								<div className="absolute bottom-8 left-12 h-3 w-3 rounded-full bg-blue-500 shadow-lg"></div>
								<div className="absolute right-8 bottom-12 h-3 w-3 rounded-full bg-yellow-500 shadow-lg"></div>

								{/* 右上角玩家列表 */}
								<div className="absolute top-4 right-4 z-10">
									<div className="w-48 rounded-lg border border-gray-200 bg-white/95 shadow-lg backdrop-blur-sm">
										<div className="rounded-t-lg border-b border-gray-100 bg-gray-50/50 px-3 py-2">
											<h3 className="flex items-center gap-2 text-xs font-semibold text-gray-700">
												<Users className="h-4 w-4" />
												玩家列表
											</h3>
										</div>
										<div className="max-h-48 overflow-y-auto p-2">
											<div className="space-y-1">
												{[
													{ name: '玩家A', color: '#ff0000', score: 1250 },
													{ name: '玩家B', color: '#00ff00', score: 980 },
													{ name: '玩家C', color: '#0000ff', score: 750 },
													{ name: '玩家D', color: '#ffff00', score: 620 },
												].map((player, idx) => (
													<div
														key={idx}
														className="flex items-center justify-between rounded bg-gray-50 p-2 text-xs transition-colors hover:bg-gray-100"
													>
														<div className="flex min-w-0 items-center gap-2">
															<div
																className="h-3 w-3 shrink-0 rounded-full border border-gray-300"
																style={{ backgroundColor: player.color }}
															/>
															<span className="truncate text-xs font-medium text-gray-700">
																{player.name}
															</span>
														</div>
														<span className="ml-2 shrink-0 font-mono text-xs font-bold text-gray-600">
															{player.score}
														</span>
													</div>
												))}
											</div>
										</div>
									</div>
								</div>
							</div>

							{/* 统一的触发点 - 用于吸顶导航 */}
							<div className="absolute right-0 bottom-0 left-0">
								<div className="h-12"></div>
							</div>
						</div>
					</div>
				</AnimatedContent>
			</section>

			{/* 特性介绍 */}
			<section className="border-zinc-100 bg-white py-24">
				<div className="mx-auto max-w-7xl px-6">
					<div className="mb-16 md:text-center">
						<h2 className="text-3xl font-bold tracking-tight text-zinc-900">
							为什么选择 Infinite Brain？
						</h2>
						<p className="mt-4 text-zinc-500">摒弃繁杂功能，回归创作本质。</p>
					</div>

					<div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
						<FeatureCard
							icon="zap"
							title="毫秒级同步"
							desc="基于 WebSocket 的高频数据传输，感受不到任何延迟，就像在本地绘画一样流畅。"
						/>
						<FeatureCard
							icon="layers"
							title="矢量化存储"
							desc="每一笔都保存为矢量数据，无论放大多少倍依然清晰锐利。支持无限撤销与重做。"
						/>
						<FeatureCard
							icon="users"
							title="多人实时协作"
							desc="邀请团队成员加入同一个房间，实时看到对方的光标与笔迹，即时头脑风暴。"
						/>
						<FeatureCard
							icon="pen-tool"
							title="极简工具箱"
							desc="没有复杂的菜单。钢笔、橡皮、颜色选择，专注于快速表达你的想法。"
						/>
						<FeatureCard
							icon="shield-check"
							title="数据安全"
							desc="所有数据经过加密传输，并支持私有化部署。你的创意资产安全无虞。"
						/>
						<FeatureCard
							icon="arrow-right"
							title="无限画布"
							desc="不再受限于屏幕大小。按住右键即可自由拖拽画布，空间随你的思维延伸。"
						/>
						<FeatureCard
							icon="atom"
							title="无限进步"
							desc="探索未知，无限可能。"
						/>
					</div>
				</div>
			</section>

			{/* CTA */}
			<section className="bg-zinc-50 py-24">
				<div className="mx-auto max-w-4xl px-6 text-center">
					<h2 className="mb-6 text-4xl font-bold tracking-tight text-zinc-900">
						准备好开始创作了吗？
					</h2>
					<p className="mb-10 text-lg text-zinc-500">
						使用 Infinite Brain 捕捉稍纵即逝的灵感。
					</p>
					<div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
						{isLogged === true ? (
							<Button
								onClick={() => navigate('/room')}
								className="min-w-40 rounded-xl bg-zinc-900 px-8 py-4 text-base font-bold text-white shadow-lg shadow-zinc-200 transition-all hover:bg-zinc-800"
							>
								前往房间
							</Button>
						) : (
							<>
								<Button
									onClick={() => navigate('/register')}
									className="min-w-40 rounded-xl bg-zinc-900 px-8 py-4 text-base font-bold text-white shadow-lg shadow-zinc-200 transition-all hover:bg-zinc-800"
								>
									立即注册
								</Button>
								<Button
									variant="outline"
									onClick={() => navigate('/login')}
									className="min-w-40 rounded-xl border border-zinc-200 bg-white px-8 py-4 text-base font-bold text-zinc-900 transition-all hover:bg-zinc-50"
								>
									登录账号
								</Button>
							</>
						)}
					</div>
				</div>
			</section>

			{/*  Footer  */}
			<footer className="bg-zinc-900 py-12 text-white">
				<div className="mx-auto max-w-7xl px-6">
					<div className="grid grid-cols-1 gap-8 md:grid-cols-4">
						<div>
							<div className="mb-4 flex items-center gap-2">
								<Brain className="h-6 w-6" />
								<h3 className="text-lg font-bold">Infinite Brain</h3>
							</div>
							<p className="text-sm text-zinc-400">
								释放你的创造力，无限延伸你的思维边界。
							</p>
						</div>
						<div>
							<h4 className="mb-4 text-sm font-semibold">产品</h4>
							<ul className="space-y-2 text-sm text-zinc-400">
								<li>
									<a
										href="/product/function"
										className="transition-colors hover:text-white"
									>
										功能
									</a>
								</li>
							</ul>
						</div>
						<div>
							<h4 className="mb-4 text-sm font-semibold">支持</h4>
							<ul className="space-y-2 text-sm text-zinc-400">
								<li>
									<a
										href="/support/help"
										className="transition-colors hover:text-white"
									>
										帮助中心
									</a>
								</li>
								<li>
									<a
										href="/support/connect"
										className="transition-colors hover:text-white"
									>
										联系我们
									</a>
								</li>
							</ul>
						</div>
						<div className="hidden">
							<h4 className="mb-4 text-sm font-semibold">关注我们</h4>
							<div className="flex space-x-4">
								<a
									href="#"
									className="text-zinc-400 transition-colors hover:text-white"
								>
									Twitter
								</a>
								<a
									href="#"
									className="text-zinc-400 transition-colors hover:text-white"
								>
									GitHub
								</a>
							</div>
						</div>
					</div>
					<div className="mt-8 border-t border-zinc-800 pt-8 text-center text-sm text-zinc-400">
						<p>
							© {new Date().getFullYear()} Infinite Brain. All rights reserved.
						</p>
					</div>
				</div>
			</footer>
		</div>
	);
}
