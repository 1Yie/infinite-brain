import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
	guessDrawApi,
	guessDrawWsApi,
	type GameState,
	type DrawMessage,
} from '@/api/guess-draw';
import {
	WhiteboardCanvas,
	type WhiteboardCanvasHandle,
} from '@/pages/white-board/whiteboard-canvas';
import { useAuth } from '@/context/auth-context';
import { SetTitle } from '@/utils/set-title';
import {
	Pencil,
	Eraser,
	CircleUser,
	Trophy,
	MessageSquare,
	Users,
	Play,
	ArrowLeft,
	Loader2,
	RotateCcw,
} from 'lucide-react';

type SocketType = ReturnType<typeof guessDrawWsApi.connect>;

export function GuessDrawPage() {
	const navigate = useNavigate();
	const { roomId } = useParams<{ roomId: string }>();
	const { user } = useAuth();
	const canvasRef = useRef<WhiteboardCanvasHandle>(null);
	const socketRef = useRef<SocketType | null>(null);

	// 游戏状态
	const [gameState, setGameState] = useState<GameState | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isConnected, setIsConnected] = useState(false);

	// 绘图状态
	const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
	const [color, setColor] = useState('#000000');
	const [size, setSize] = useState(4);

	// 猜测状态
	const [guessInput, setGuessInput] = useState('');
	const [chatMessages, setChatMessages] = useState<
		{ name: string; msg: string; isSystem?: boolean }[]
	>([]);

	// 倒计时状态
	const [timeLeft, setTimeLeft] = useState(0);

	// 派生状态 - 确保每次 gameState 变化时重新计算
	const userId = user?.id?.toString() || '';
	const currentPlayer = gameState?.players.find((p) => p.userId === userId);
	const isDrawer = currentPlayer?.isDrawing || false;
	const currentWord = isDrawer ? gameState?.currentWord : null;

	// 监控 isDrawer 变化，当身份切换时更新 UI
	useEffect(() => {
		if (!gameState?.isActive) return;

		if (isDrawer) {
			console.log('🎨 切换到画者模式');
			// 画者模式：确保画布可编辑
			// Canvas 的 readOnly 会自动响应
		} else {
			console.log('👀 切换到猜测者模式');
			// 猜测者模式：清空输入框
			setGuessInput('');
		}
	}, [isDrawer, gameState?.isActive]);

	// =================================================================
	// 倒计时管理
	// =================================================================
	useEffect(() => {
		if (!gameState?.isActive || !gameState?.roundStartTime) {
			setTimeLeft(0);
			return;
		}

		// 立即计算一次
		const calculateTimeLeft = () => {
			const elapsed = (Date.now() - gameState.roundStartTime!) / 1000;
			const remaining = Math.max(0, gameState.roundTimeLimit - elapsed);
			return remaining;
		};

		setTimeLeft(calculateTimeLeft());

		// 每100ms更新一次，更流畅
		const timer = setInterval(() => {
			const remaining = calculateTimeLeft();
			setTimeLeft(remaining);

			if (remaining <= 0) {
				clearInterval(timer);
			}
		}, 100);

		return () => clearInterval(timer);
	}, [
		gameState?.isActive,
		gameState?.roundStartTime,
		gameState?.roundTimeLimit,
	]);

	// =================================================================
	// WebSocket 连接与事件处理
	// =================================================================
	useEffect(() => {
		if (!roomId || !userId) return;

		console.log('🔌 建立 WebSocket 连接...');
		const ws = guessDrawWsApi.connect(roomId);
		socketRef.current = ws;

		ws.subscribe((message) => {
			const data = message.data as DrawMessage;
			console.log('📨 收到消息:', data.type, data);

			switch (data.type) {
				case 'connected':
					console.log('✅ WebSocket 连接成功');
					setIsConnected(true);
					break;

				case 'game-state':
					console.log('🎮 更新游戏状态:', {
						isActive: data.data.isActive,
						currentRound: data.data.currentRound,
						currentDrawer: data.data.currentDrawer,
						roundStartTime: data.data.roundStartTime,
						wordHint: data.data.wordHint,
					});

					if (data.data) {
						// 检查身份是否变化
						const oldState = gameState;
						const newState = data.data;

						setGameState(newState);
						setIsLoading(false);

						// 身份变化日志
						if (oldState && newState.currentDrawer !== oldState.currentDrawer) {
							const newDrawer = newState.players.find(
								(p) => p.userId === newState.currentDrawer
							);
							console.log('🔄 画者切换:', {
								from: oldState.currentDrawer,
								to: newState.currentDrawer,
								newDrawerName: newDrawer?.username,
							});

							// 检查当前用户身份
							const myNewState = newState.players.find(
								(p) => p.userId === userId
							);
							if (myNewState) {
								console.log('👤 我的新身份:', {
									isDrawing: myNewState.isDrawing,
									isCurrentDrawer: newState.currentDrawer === userId,
								});
							}
						}
					}
					break;

				case 'game-started':
					console.log('🎮 游戏开始!');
					setChatMessages((prev) => [
						...prev.slice(-19),
						{
							name: '系统',
							msg: '游戏开始！',
							isSystem: true,
						},
					]);
					break;

				case 'user-joined':
					console.log(`👋 ${data.username} 加入房间`);
					setChatMessages((prev) => [
						...prev.slice(-19),
						{
							name: '系统',
							msg: `${data.username || '未知用户'} 加入了房间`,
							isSystem: true,
						},
					]);
					break;

				case 'user-left':
					console.log(`👋 ${data.username} 离开房间`);
					setChatMessages((prev) => [
						...prev.slice(-19),
						{
							name: '系统',
							msg: `${data.username || '未知用户'} 离开了房间`,
							isSystem: true,
						},
					]);
					break;

				case 'round-start':
					console.log(`🎯 第 ${data.currentRound} 回合开始`);
					console.log(`   画者: ${data.drawerUsername}`);
					console.log(`   提示: ${data.wordHint}`);

					// 清空画布
					canvasRef.current?.clear();

					// 添加系统消息
					setChatMessages((prev) => [
						...prev.slice(-19),
						{
							name: '系统',
							msg: `第 ${data.currentRound} 回合开始！画者: ${data.drawerUsername}`,
							isSystem: true,
						},
					]);
					break;

				case 'round-end':
					console.log(`🏁 回合结束，答案: ${data.word}`);

					let endMessage = '';
					if (data.winner) {
						endMessage = `回合结束！正确答案: ${data.word}`;
					} else if (data.reason === 'timeout') {
						endMessage = `时间到！正确答案: ${data.word}`;
					} else if (data.reason === 'drawer-left') {
						endMessage = `画者离开，回合结束。正确答案: ${data.word}`;
					} else {
						endMessage = `回合结束！正确答案: ${data.word}`;
					}

					setChatMessages((prev) => [
						...prev.slice(-19),
						{
							name: '系统',
							msg: endMessage,
							isSystem: true,
						},
					]);
					break;

				case 'game-end':
					console.log('🎊 游戏结束');
					setChatMessages((prev) => [
						...prev.slice(-19),
						{
							name: '系统',
							msg: '游戏结束！',
							isSystem: true,
						},
					]);
					break;

				case 'guess-correct':
					console.log(`✅ ${data.username} 猜对了！获得 ${data.score} 分`);
					setChatMessages((prev) => [
						...prev.slice(-19),
						{
							name: '系统',
							msg: `🎉 ${data.username} 猜对了！获得 ${data.score} 分`,
							isSystem: true,
						},
					]);
					break;

				case 'guess-attempt':
					console.log(`💭 ${data.attempt.username}: ${data.attempt.guess}`);
					setChatMessages((prev) => [
						...prev.slice(-19),
						{
							name: data.attempt.username,
							msg: data.attempt.guess,
						},
					]);
					break;

				case 'game-chat':
					console.log(`💬 ${data.username}: ${data.message}`);
					setChatMessages((prev) => [
						...prev.slice(-19),
						{
							name: data.username || '未知用户',
							msg: data.message,
						},
					]);
					break;

				case 'draw':
				case 'stroke-finish':
					// 只接收其他人的绘画数据
					if (data.userId !== userId && data.data) {
						canvasRef.current?.drawRemote(data.data);
					}
					break;

				case 'clear':
					// 只接收其他人的清空操作
					if (data.userId !== userId) {
						canvasRef.current?.clear();
					}
					break;

				default:
					console.log('❓ 未知消息类型:', data.type);
			}
		});

		// 初始获取状态（兜底）
		guessDrawApi
			.getRoomState(roomId)
			.then((res) => {
				if (res.success && res.data) {
					console.log('📥 获取初始状态成功');
					setGameState(res.data.gameState);
					setIsLoading(false);
				}
			})
			.catch((err) => {
				console.error('❌ 获取初始状态失败', err);
				setIsLoading(false);
			});

		return () => {
			console.log('🔌 关闭 WebSocket 连接');
			if (socketRef.current) {
				socketRef.current.close();
				setIsConnected(false);
			}
		};
	}, [roomId, userId]);

	// =================================================================
	// 交互逻辑
	// =================================================================

	const handleStartGame = async () => {
		if (!socketRef.current) {
			console.error('❌ WebSocket 连接未建立');
			return;
		}
		if (!gameState) {
			console.error('❌ 游戏状态未初始化');
			return;
		}
		console.log('🎮 发送游戏开始请求...');
		guessDrawWsApi.sendGameStart(socketRef.current, gameState.totalRounds);
	};

	const handleSubmitGuess = async () => {
		if (isDrawer) {
			console.log('⚠️ 画者不能猜词');
			return;
		}

		if (!guessInput.trim() || !socketRef.current) return;

		console.log('💭 发送猜测:', guessInput);
		guessDrawWsApi.sendGuess(socketRef.current, guessInput.trim());
		setGuessInput('');
	};

	const handleSendChat = () => {
		if (!guessInput.trim() || !socketRef.current) return;

		console.log('💬 发送聊天:', guessInput);
		guessDrawWsApi.sendGameChat(socketRef.current, guessInput.trim());
		setGuessInput('');
	};

	const handleStrokeFinished = useCallback(
		(stroke: DrawMessage['data']) => {
			if (!isDrawer || !socketRef.current) {
				return;
			}
			guessDrawWsApi.sendStrokeFinish(socketRef.current, stroke);
		},
		[isDrawer]
	);

	const handleRealtimeDraw = useCallback(
		(data: DrawMessage['data']) => {
			if (!isDrawer || !socketRef.current) {
				return;
			}
			guessDrawWsApi.sendDraw(socketRef.current, data);
		},
		[isDrawer]
	);

	const handleClearCanvas = () => {
		if (!isDrawer || !socketRef.current) {
			console.log('⚠️ 只有画者才能清空画布');
			return;
		}
		canvasRef.current?.clear();
		guessDrawWsApi.sendClear(socketRef.current);
	};

	// =================================================================
	// 渲染
	// =================================================================

	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader2 className="mx-auto h-8 w-8 animate-spin" />
			</div>
		);
	}

	if (!gameState) {
		console.error('❌ 游戏状态不存在');
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="text-center">
					<p className="text-lg text-gray-600">房间不存在</p>
					<Button onClick={() => navigate('/room')} className="mt-4">
						返回房间列表
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<SetTitle title={`你猜我画 - 房间 ${roomId}`} />

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
								<ArrowLeft className="mr-2 h-4 w-4" /> 退出
							</Button>
							<h1 className="text-xl font-semibold">你猜我画</h1>
							<Badge variant="outline" className="ml-4">
								房间: {roomId}
							</Badge>
						</div>
						<div className="flex items-center space-x-4">
							<Badge variant={isConnected ? 'default' : 'destructive'}>
								{isConnected ? '在线' : '离线'}
							</Badge>
							<div className="flex items-center">
								<Users className="mr-1 h-4 w-4" />
								<span>{gameState.players.length} 玩家</span>
							</div>
							<div className="flex items-center">
								<Trophy className="mr-1 h-4 w-4" />
								<span>
									第 {gameState.currentRound}/{gameState.totalRounds} 回合
								</span>
							</div>
						</div>
					</div>
				</div>
			</header>

			<div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
					{/* 左侧：游戏信息 & 玩家列表 */}
					<div className="space-y-6 lg:col-span-1">
						<Card>
							<CardHeader>
								<CardTitle>游戏状态</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								{!gameState.isActive ? (
									<>
										<div className="rounded-lg bg-slate-100 p-4 text-center">
											<div className="text-lg font-semibold text-gray-700">
												准备中...
											</div>
											<div className="mt-2 text-sm text-gray-500">
												等待玩家加入
											</div>
										</div>
										<Button onClick={handleStartGame} className="w-full">
											<Play className="mr-2 h-4 w-4" /> 开始游戏
										</Button>
									</>
								) : (
									<>
										<div className="mb-4 text-center">
											<div className="font-mono text-3xl font-bold">
												{Math.ceil(timeLeft)}s
											</div>
											<div className="text-sm text-gray-500">剩余时间</div>
										</div>

										<div className="rounded-lg bg-slate-100 p-4 text-center">
											{isDrawer ? (
												<>
													<div className="mb-1 text-sm text-gray-500">
														你要画的词是
													</div>
													<div className="text-primary text-2xl font-bold">
														{currentWord}
													</div>
												</>
											) : (
												<>
													<div className="mb-1 text-sm text-gray-500">提示</div>
													<div className="font-mono text-xl tracking-widest">
														{gameState.wordHint || '等待中...'}
													</div>
												</>
											)}
										</div>

										<div className="flex items-center justify-between text-sm">
											<span>当前画者:</span>
											<Badge variant="secondary">
												{gameState.players.find(
													(p) => p.userId === gameState.currentDrawer
												)?.username || '未知'}
											</Badge>
										</div>
									</>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="text-base">玩家排行</CardTitle>
							</CardHeader>
							<CardContent className="p-2">
								{gameState.players
									.sort((a, b) => b.score - a.score)
									.map((player) => (
										<div
											key={player.userId}
											className={`flex items-center justify-between rounded p-2 ${
												player.userId === gameState.currentDrawer
													? 'bg-blue-50'
													: ''
											}`}
										>
											<div className="flex items-center gap-2">
												<CircleUser className="h-5 w-5 text-gray-500" />
												<span
													className={`text-sm ${
														player.userId === userId ? 'font-bold' : ''
													}`}
												>
													{player.username}
												</span>
												{player.isDrawing && (
													<Pencil className="h-3 w-3 text-blue-500" />
												)}
												{player.hasGuessed && (
													<Badge
														className="px-1 py-0 text-[10px]"
														variant="default"
													>
														已猜对
													</Badge>
												)}
											</div>
											<span className="font-mono font-bold">
												{player.score}
											</span>
										</div>
									))}
							</CardContent>
						</Card>
					</div>

					{/* 中间：画布 */}
					<div className="lg:col-span-2">
						<Card className="flex h-full flex-col">
							<CardHeader className="flex flex-row items-center justify-between space-y-0 border-b px-4 py-3">
								<CardTitle className="text-base">画布</CardTitle>
								{isDrawer && gameState.isActive && (
									<div className="flex items-center space-x-2">
										<Button
											variant={tool === 'pen' ? 'default' : 'ghost'}
											size="icon"
											className="h-8 w-8"
											onClick={() => setTool('pen')}
										>
											<Pencil className="h-4 w-4" />
										</Button>
										<Button
											variant={tool === 'eraser' ? 'default' : 'ghost'}
											size="icon"
											className="h-8 w-8"
											onClick={() => setTool('eraser')}
										>
											<Eraser className="h-4 w-4" />
										</Button>
										<div className="mx-2 h-6 w-px bg-gray-200"></div>
										<input
											type="color"
											value={color}
											onChange={(e) => setColor(e.target.value)}
											className="h-8 w-8 cursor-pointer rounded border-0 p-0"
											title="选择颜色"
										/>
										<input
											type="range"
											min="1"
											max="20"
											value={size}
											onChange={(e) => setSize(Number(e.target.value))}
											className="accent-primary w-20"
											title="笔刷大小"
										/>
										<div className="mx-2 h-6 w-px bg-gray-200"></div>
										<Button
											variant="ghost"
											size="icon"
											className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
											onClick={handleClearCanvas}
										>
											<RotateCcw className="h-4 w-4" />
										</Button>
									</div>
								)}
							</CardHeader>
							<CardContent className="relative flex-1 cursor-crosshair bg-white p-0">
								<div className="h-[500px] w-full">
									<WhiteboardCanvas
										ref={canvasRef}
										tool={tool}
										color={color}
										size={size}
										readOnly={!isDrawer || !gameState.isActive}
										roomId={roomId || ''}
										onStrokeFinished={handleStrokeFinished}
										onRealtimeDraw={handleRealtimeDraw}
										key={`canvas-${isDrawer}-${gameState.currentRound}`}
									/>
								</div>
								{!gameState.isActive && (
									<div className="absolute inset-0 flex items-center justify-center bg-black/5 backdrop-blur-[1px]">
										<span className="font-medium text-gray-500">
											等待游戏开始...
										</span>
									</div>
								)}
								{gameState.isActive && !isDrawer && (
									<div className="absolute inset-0 flex items-center justify-center bg-transparent">
										<span className="rounded-lg bg-black/70 px-4 py-2 font-medium text-white">
											👀 观看中...
										</span>
									</div>
								)}
							</CardContent>
						</Card>
					</div>

					{/* 右侧：聊天与猜测 */}
					<div className="flex h-[600px] flex-col space-y-6 lg:col-span-1">
						<Card className="flex flex-1 flex-col">
							<CardHeader className="border-b px-4 py-3">
								<CardTitle className="flex items-center text-base">
									<MessageSquare className="mr-2 h-4 w-4" /> 聊天 / 猜测
								</CardTitle>
							</CardHeader>
							<CardContent className="flex min-h-0 flex-1 flex-col p-0">
								{/* 消息列表 */}
								<div className="flex-1 space-y-2 overflow-y-auto p-4">
									{chatMessages.map((msg, idx) => (
										<div
											key={idx}
											className={`text-sm ${msg.isSystem ? 'text-center' : ''}`}
										>
											{msg.isSystem ? (
												<span className="text-gray-500 italic">{msg.msg}</span>
											) : (
												<>
													<span className="font-bold text-gray-700">
														{msg.name}:
													</span>
													<span className="ml-1 text-gray-600">{msg.msg}</span>
												</>
											)}
										</div>
									))}
									{chatMessages.length === 0 && (
										<div className="mt-10 text-center text-sm text-gray-400">
											暂无消息
										</div>
									)}
								</div>

								{/* 输入框 */}
								{gameState.isActive && (
									<div className="border-t bg-gray-50 p-3">
										<div className="flex gap-2">
											<Input
												placeholder={
													isDrawer ? '和大家聊聊...' : '输入答案或聊天...'
												}
												value={guessInput}
												onChange={(e) => setGuessInput(e.target.value)}
												onKeyDown={(e) =>
													e.key === 'Enter' &&
													(isDrawer ? handleSendChat() : handleSubmitGuess())
												}
												className="bg-white"
											/>
											<Button
												onClick={isDrawer ? handleSendChat : handleSubmitGuess}
												disabled={!guessInput.trim()}
												size="sm"
											>
												发送
											</Button>
										</div>
										<div className="mt-1 text-center text-[10px] text-gray-400">
											{isDrawer
												? '画者只能聊天，不能猜词'
												: '直接输入答案即可提交'}
										</div>
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
}
