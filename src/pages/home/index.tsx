import { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { WhiteboardCanvas } from '../white-board/whiteboard-canvas';
import { WhiteboardToolbar } from '../white-board/whiteboard-toolbar';
import type {
	WhiteboardCanvasHandle,
	DrawData,
} from '../white-board/whiteboard-canvas';
import { useWebSocket } from '../../hooks/use-websocket';
import type { StrokeData } from '../../types/whiteboard';
import { DynamicIcon } from 'lucide-react/dynamic';
import { authApi } from '../../api/auth';
import { Button } from '../../components/ui/button';
import { Pen } from 'lucide-react';

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

	// WebSocket
	const {
		isConnected,
		userId,
		onMessage,
		sendDraw,
		sendStrokeFinish,
		sendUndo,
		sendRedo,
	} = useWebSocket(false, roomId); // 首页不需要强制登录状态

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
					canvasRef.current?.removeStrokeById(msg.strokeId);
				}
			}
			if (msg.type === 'redo') {
				// 处理重做消息：添加服务器广播的笔画数据
				canvasRef.current?.addStroke(msg.data as StrokeData);
			}
		});
		return () => unsubscribe();
	}, [userId, onMessage]);

	const handleFinish = useCallback(
		(stroke: Omit<StrokeData, 'id'>) => {
			if (!isConnected) return;
			sendStrokeFinish({ ...stroke, id: crypto.randomUUID() });
		},
		[isConnected, sendStrokeFinish]
	);

	const handleUndo = useCallback(() => {
		// 只发送撤销请求给后端，由服务器控制撤销操作
		sendUndo();
	}, [sendUndo]);

	const handleRedo = useCallback(() => {
		sendRedo();
	}, [sendRedo]);

	// 滚动监听
	useEffect(() => {
		const handleScroll = () => {
			if (!triggerRef.current) return;
			const rect = triggerRef.current.getBoundingClientRect();
			// 当原工具栏位置滚出视口顶部时，显示吸顶导航
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
						<Pen className="h-6 w-6" />
						<span className="text-lg font-bold tracking-tight">
							Infinite Board
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
			<section className="relative flex min-h-[85vh] flex-col pt-10">
				<div className="mx-auto mb-8 max-w-3xl px-6 text-center">
					{/* <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
						<span className="relative flex h-2 w-2">
							<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
							<span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
						</span>
						多人实时协作演示中
					</div> */}
					<h1 className="mb-4 text-2xl font-extrabold tracking-tight text-zinc-600 sm:text-4xl">
						Infinite Board
					</h1>
					<h1 className="text-3xl font-extrabold tracking-tight text-zinc-800 sm:text-5xl">
						让创意{' '}
						<span className="text-zinc-400 line-through decoration-zinc-800 decoration-2">
							受限
						</span>
						<span className="ml-2 bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
							无限延伸
						</span>
					</h1>
				</div>

				{/* 白板容器 */}
				<div className="relative mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6">
					<div className="relative h-full min-h-[500px] overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 shadow-sm">
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
						<div ref={triggerRef} className="absolute right-0 bottom-0 left-0">
							<div className="bordershadow-lg rounded-xl backdrop-blur supports-[backdrop-filter]:bg-white/60">
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
				</div>
			</section>

			{/* 特性介绍 */}
			<section className="border-zinc-100 bg-white py-24">
				<div className="mx-auto max-w-7xl px-6">
					<div className="mb-16 md:text-center">
						<h2 className="text-3xl font-bold tracking-tight text-zinc-900">
							为什么选择 Infinite Board？
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
						使用 Infinite Board 捕捉稍纵即逝的灵感。
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
								<Pen className="h-6 w-6" />
								<h3 className="text-lg font-bold">Infinite Board</h3>
							</div>
							<p className="text-sm text-zinc-400">
								让创意无限延伸的白板应用。
							</p>
						</div>
						<div>
							<h4 className="mb-4 text-sm font-semibold">产品</h4>
							<ul className="space-y-2 text-sm text-zinc-400">
								<li>
									<a href="#" className="transition-colors hover:text-white">
										功能
									</a>
								</li>
								<li>
									<a href="#" className="transition-colors hover:text-white">
										定价
									</a>
								</li>
							</ul>
						</div>
						<div>
							<h4 className="mb-4 text-sm font-semibold">支持</h4>
							<ul className="space-y-2 text-sm text-zinc-400">
								<li>
									<a href="#" className="transition-colors hover:text-white">
										帮助中心
									</a>
								</li>
								<li>
									<a href="#" className="transition-colors hover:text-white">
										联系我们
									</a>
								</li>
							</ul>
						</div>
						<div>
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
							© {new Date().getFullYear()} Infinite Board. All rights reserved.
						</p>
					</div>
				</div>
			</footer>
		</div>
	);
}
