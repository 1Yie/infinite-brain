import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
	guessDrawApi,
	guessDrawWsApi,
	type GameState,
	type GamePlayer,
} from '@/api/guess-draw';

// WebSocket 消息类型
interface WebSocketMessage {
	type: string;
	data?: DrawData | StrokeData | GameState;
	userId?: string;
	username?: string;
	roomId?: string;
	timestamp?: number;
	// 游戏相关字段
	totalRounds?: number;
	guess?: string;
	message?: string;
	attempt?: {
		userId: string;
		username: string;
		guess: string;
		isCorrect: boolean;
		timestamp: number;
	};
	score?: number;
	// 回合相关字段
	currentRound?: number;
	drawerUsername?: string;
	wordHint?: string;
	word?: string;
	winner?: boolean;
	reason?: string;
	winnerName?: string;
	roundTimeLimit?: number;
	roundStartTime?: number;
}
import {
	WhiteboardCanvas,
	type WhiteboardCanvasHandle,
	type DrawData,
	type StrokeData,
} from '../../board-room/white-board/whiteboard-canvas';
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
	Send,
	Gamepad2,
	Clock,
} from 'lucide-react';

type SocketType = ReturnType<typeof guessDrawWsApi.connect>;

export function GuessDrawPage() {
	const navigate = useNavigate();
	const { roomId } = useParams<{ roomId: string }>();
	const { user } = useAuth();
	const gameStateRef = useRef<GameState | null>(null);
	const socketRef = useRef<SocketType | null>(null);
	const canvasRef = useRef<WhiteboardCanvasHandle>(null);
	const chatMessagesRef = useRef<HTMLDivElement>(null);

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
			// 猜测者模式不需要特殊处理
		}
	}, [isDrawer, gameState?.isActive]);

	// 倒计时状态
	const [timeLeft, setTimeLeft] = useState(0);

	// 自动更新倒计时
	useEffect(() => {
		if (!gameState?.isActive || !gameState?.roundStartTime) {
			// 使用setTimeout避免在effect中同步调用setState
			setTimeout(() => setTimeLeft(0), 0);
			return;
		}

		const updateTimeLeft = () => {
			const elapsed = (Date.now() - gameState.roundStartTime!) / 1000;
			const remaining = Math.max(0, gameState.roundTimeLimit - elapsed);
			setTimeLeft(remaining);
		};

		// 立即更新一次
		updateTimeLeft();

		// 每100ms更新一次
		const timer = setInterval(updateTimeLeft, 100);

		return () => clearInterval(timer);
	}, [
		gameState?.isActive,
		gameState?.roundStartTime,
		gameState?.roundTimeLimit,
	]);

	// 自动滚动到最新消息
	useEffect(() => {
		if (chatMessagesRef.current) {
			chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
		}
	}, [chatMessages]);

	useEffect(() => {
		if (!roomId || !userId) return;

		console.log('🔌 建立 WebSocket 连接...');
		const ws = guessDrawWsApi.connect(roomId);
		socketRef.current = ws;

		ws.subscribe((message) => {
			const data = message.data as WebSocketMessage;
			console.log('📨 收到消息:', data.type, data);

			switch (data.type) {
				case 'connected':
					console.log('✅ WebSocket 连接成功');
					setIsConnected(true);
					break;

				case 'game-state':
					console.log('🎮 更新游戏状态:', data.data);

					if (
						data.data &&
						typeof data.data === 'object' &&
						'isActive' in data.data
					) {
						// 检查身份是否变化
						const oldState = gameStateRef.current;
						const newState = data.data as GameState;

						setGameState(newState);
						gameStateRef.current = newState; // 更新ref
						setIsLoading(false);

						// 房间为空是正常状态，允许创建新房间
						if (newState.players.length === 0) {
							console.log('🏠 房间为空，等待玩家加入或创建新游戏');
							// 不进行任何跳转，保持当前页面状态
						}

						// 身份变化日志
						if (oldState && newState.currentDrawer !== oldState.currentDrawer) {
							const newDrawer = newState.players.find(
								(p: GamePlayer) => p.userId === newState.currentDrawer
							);
							console.log('🔄 画者切换:', {
								from: oldState.currentDrawer,
								to: newState.currentDrawer,
								newDrawerName: newDrawer?.username,
							});

							// 检查当前用户身份
							const myNewState = newState.players.find(
								(p: GamePlayer) => p.userId === userId
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
					console.log(`   回合时间: ${data.roundTimeLimit}秒`);

					// 更新游戏状态中的回合时间和开始时间
					setGameState((prev) => {
						if (!prev) return prev;
						return {
							...prev,
							roundTimeLimit: data.roundTimeLimit || prev.roundTimeLimit || 60,
							roundStartTime: data.roundStartTime || prev.roundStartTime,
						};
					});

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

				case 'round-end': {
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
				}

				case 'game-end': {
					console.log('🎊 游戏结束');
					console.log('🏆 胜利者:', data.winnerName, '原因:', data.reason);

					let endMessage = '游戏结束！';
					if (data.winnerName) {
						endMessage = `🎉 ${data.winnerName} 获胜！`;
					}

					setChatMessages((prev) => [
						...prev.slice(-19),
						{
							name: '系统',
							msg: endMessage,
							isSystem: true,
						},
					]);

					// 重置游戏状态为准备阶段
					setGameState((prevState) => {
						if (!prevState) return prevState;
						return {
							...prevState,
							isActive: false,
							currentRound: 0,
							currentDrawer: null,
							currentWord: null,
							wordHint: null,
							roundStartTime: null,
							players: prevState.players.map((p) => ({
								...p,
								hasGuessed: false,
								isDrawing: false,
							})),
							usedWords: [],
						};
					});
					gameStateRef.current = null; // 清除ref
					break;
				}

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
					// 更新游戏状态中的玩家分数
					setGameState((prev) => {
						if (!prev) return prev;
						const updatedPlayers = prev.players.map((player) => {
							if (player.userId === data.userId) {
								return {
									...player,
									score: data.score || player.score + (data.score || 0),
									hasGuessed: true,
								};
							}
							return player;
						});
						return {
							...prev,
							players: updatedPlayers,
						};
					});
					break;

				case 'guess-attempt':
					console.log(`💭 ${data.attempt?.username}: ${data.attempt?.guess}`);
					setChatMessages((prev) => [
						...prev.slice(-19),
						{
							name: data.attempt?.username || '未知用户',
							msg: data.attempt?.guess || '',
						},
					]);
					break;

				case 'game-chat':
					console.log(`💬 ${data.username}: ${data.message}`);
					setChatMessages((prev) => [
						...prev.slice(-19),
						{
							name: data.username || '未知用户',
							msg: data.message || '',
						},
					]);
					break;

				case 'draw':
				case 'stroke-finish':
					// 只接收其他人的绘画数据
					if (
						data.userId !== userId &&
						data.data &&
						typeof data.data === 'object' &&
						'x' in data.data
					) {
						canvasRef.current?.drawRemote(data.data as DrawData);
					}
					break;

				case 'clear':
					// 只接收其他人的清空操作
					if (data.userId !== userId) {
						canvasRef.current?.clear();
					}
					break;

				case 'error':
					console.error('❌ 服务器错误:', data.message);
					setChatMessages((prev) => [
						...prev.slice(-19),
						{
							name: '系统',
							msg: `❌ ${data.message}`,
							isSystem: true,
						},
					]);
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
	}, [roomId, userId, navigate]); // 移除 gameState 依赖，避免不必要的重连

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
		guessDrawWsApi.sendGameStart(
			socketRef.current,
			gameState.totalRounds,
			gameState.roundTimeLimit
		);
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
		(stroke: StrokeData) => {
			if (!isDrawer || !socketRef.current) {
				return;
			}
			// @ts-expect-error ts-migrate(2345) FIXME: Argument of type 'SocketType' is not assignable to parameter of type 'WebSocket'.
			guessDrawWsApi.sendStrokeFinish(socketRef.current, stroke);
		},
		[isDrawer]
	);

	const handleRealtimeDraw = useCallback(
		(data: DrawData) => {
			if (!isDrawer || !socketRef.current) {
				return;
			}
			// @ts-expect-error ts-migrate(2345) FIXME: Argument of type 'SocketType' is not assignable to parameter of type 'WebSocket'.
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
					<Button onClick={() => navigate('/room/guess-draw')} className="mt-4">
						返回大厅
					</Button>
				</div>
			</div>
		);
	}

	// 房间为空是正常状态，允许创建新房间
	if (gameState.players.length === 0) {
		console.log('🏠 房间为空，等待玩家加入或创建新游戏');
		// 不进行任何跳转，保持当前页面状态
	}

	const canStart = gameState.players.length >= 2;

	return (
		<div className="flex h-screen w-full flex-col overflow-hidden bg-gray-50">
			<SetTitle title={`你猜我画 - 房间 ${roomId}`} />

			<header className="sticky top-0 z-10 border-b bg-white px-4 py-3 sm:px-6 lg:px-8">
				<div className="mx-auto flex max-w-7xl items-center justify-between">
					<div className="flex items-center gap-4">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => navigate('/room/guess-draw')}
							className="text-gray-600"
						>
							<ArrowLeft className="mr-1 h-4 w-4" /> 返回房间
						</Button>
						<div className="flex items-center gap-2 border-l pl-4">
							<Gamepad2 className="h-5 w-5 text-gray-900" />
							<h1 className="text-lg font-bold text-gray-900">你猜我画</h1>
							<Badge
								variant="outline"
								className="px-2 py-1 font-mono text-xs text-gray-700"
							>
								{roomId}
							</Badge>
						</div>
					</div>

					<div className="flex items-center gap-3">
						<Badge
							variant={isConnected ? 'default' : 'destructive'}
							className="px-2 py-1 transition-colors"
						>
							{isConnected ? '在线' : '离线'}
						</Badge>
						<div className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-sm text-gray-600">
							<Users className="h-3 w-3" />
							<span>{gameState.players.length}</span>
						</div>
						<div className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-sm text-gray-600">
							<Trophy className="h-3 w-3" />
							<span>
								{gameState.currentRound}/{gameState.totalRounds}
							</span>
						</div>
					</div>
				</div>
			</header>

			<div className="z-20 flex-none border-b bg-white px-3 py-2 shadow-sm xl:hidden">
				<div className="flex h-14 items-center gap-3">
					{/* 左侧：精简状态 */}
					<div className="flex min-w-20 flex-none flex-col items-center justify-center border-r pr-3">
						{!gameState.isActive ? (
							<Button
								onClick={handleStartGame}
								disabled={!canStart}
								size="sm"
								className="h-12 w-full bg-black text-base hover:bg-gray-800"
							>
								开始
							</Button>
						) : (
							<>
								<div
									className={`font-mono text-xl leading-none font-bold ${Math.ceil(timeLeft) <= 10 ? 'text-red-500' : 'text-gray-800'}`}
								>
									{Math.ceil(timeLeft)}
								</div>
								{isDrawer ? (
									<div className="max-w-16 truncate text-xs font-bold text-blue-600">
										{currentWord}
									</div>
								) : (
									<div className="font-mono text-xs tracking-widest text-gray-700">
										{gameState.wordHint}
									</div>
								)}
							</>
						)}
					</div>
					<div className="scrollbar-none flex flex-1 items-center gap-2 overflow-x-auto">
						{gameState.players
							.sort((a, b) => b.score - a.score)
							.map((player) => (
								<div
									key={player.userId}
									className={`flex flex-none items-center gap-2 rounded border px-2 py-1 ${
										player.userId === gameState.currentDrawer
											? 'border-blue-300 bg-blue-50 shadow-sm'
											: 'border-gray-200 bg-white'
									}`}
								>
									{/* 头像 */}
									<div className="relative">
										<div
											className={`flex h-7 w-7 items-center justify-center rounded-full ${
												player.userId === userId
													? 'bg-black text-white'
													: 'bg-gray-100 text-gray-500'
											}`}
										>
											<CircleUser className="h-4 w-4" />
										</div>

										{player.hasGuessed && (
											<div className="absolute -top-1 -right-1 h-2 w-2 rounded-full border border-white bg-green-500" />
										)}
									</div>

									{/* 名字 + 分数（竖向） */}
									<div className="flex flex-col gap-0 leading-tight">
										<p className="text-sm font-medium text-gray-800">
											{player.username}
										</p>
										<p className="font-mono text-sm text-gray-500">
											{player.score}
										</p>
									</div>
								</div>
							))}
					</div>
				</div>
			</div>

			<div className="flex flex-1 gap-4 overflow-hidden p-4">
				{/* A. 左侧边栏 (仅在 xl 以上显示) */}
				<div className="hidden w-64 flex-none flex-col gap-4 xl:flex">
					{/* 状态面板 */}
					<div className="flex flex-none flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
						<div className="border-b border-gray-100 bg-gray-50/50 px-4 py-3">
							<h3 className="text-sm font-semibold text-gray-700">状态</h3>
						</div>
						<div className="p-4">
							{!gameState.isActive ? (
								<div className="space-y-3">
									<div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
										<p className="text-sm text-gray-500">等待开始</p>
										<p className="mt-1 text-xs text-gray-400">需至少2人</p>
									</div>
									<Button
										onClick={handleStartGame}
										className="w-full bg-black text-white hover:bg-gray-800"
										disabled={!canStart}
									>
										<Play className="mr-2 h-4 w-4" /> 开始
									</Button>
								</div>
							) : (
								<div className="space-y-4">
									<div className="text-center">
										<span
											className={`font-mono text-5xl font-bold ${Math.ceil(timeLeft) <= 10 ? 'text-red-500' : 'text-gray-800'}`}
										>
											{Math.ceil(timeLeft)}
										</span>
										<span className="mt-1 block text-xs text-gray-400">
											剩余时间
										</span>
									</div>
									<div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-center">
										{isDrawer ? (
											<>
												<div className="mb-1 text-xs text-blue-400">
													目标词汇
												</div>
												<div className="text-lg font-bold text-blue-600">
													{currentWord}
												</div>
											</>
										) : (
											<>
												<div className="mb-1 text-xs text-gray-400">提示</div>
												<div className="font-mono text-xl tracking-[0.2em] text-gray-800">
													{gameState.wordHint}
												</div>
											</>
										)}
									</div>
									<div className="flex items-center justify-between px-1 text-xs">
										<span className="text-gray-500">画者</span>
										<Badge
											variant="outline"
											className="max-w-[100px] truncate border-gray-200 bg-white"
										>
											{gameState.players.find(
												(p) => p.userId === gameState.currentDrawer
											)?.username || '未知'}
										</Badge>
									</div>
								</div>
							)}
						</div>
					</div>

					{/* 竖向玩家列表 */}
					<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
						<div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-4 py-3">
							<h3 className="text-sm font-semibold text-gray-700">排行榜</h3>
						</div>
						<div className="flex-1 space-y-1 overflow-y-auto p-2">
							{gameState.players
								.sort((a, b) => b.score - a.score)
								.map((player) => (
									<div
										key={player.userId}
										className={`flex items-center justify-between rounded-lg p-2 text-sm transition-colors ${player.userId === gameState.currentDrawer ? 'border border-blue-100 bg-blue-50' : 'border border-transparent hover:bg-gray-50'}`}
									>
										<div className="flex min-w-0 items-center gap-2">
											<div
												className={`flex h-8 w-8 flex-none items-center justify-center rounded-full ${player.userId === userId ? 'bg-black text-white' : 'bg-gray-100 text-gray-500'}`}
											>
												<CircleUser className="h-4 w-4" />
											</div>
											<div className="flex min-w-0 flex-col">
												<span
													className={`truncate text-xs ${player.userId === userId ? 'font-bold text-gray-900' : 'font-medium text-gray-600'}`}
												>
													{player.username}
												</span>
												{player.isDrawing &&
													player.userId !== userId &&
													gameState.isActive && (
														<span className="flex items-center gap-1 text-[10px] text-blue-500">
															<Pencil className="h-3 w-3" /> 正在画
														</span>
													)}
											</div>
										</div>
										<div className="text-right">
											<div className="font-mono font-bold text-gray-700">
												{player.score}
											</div>
											{player.hasGuessed &&
												player.userId !== userId &&
												gameState.isActive && (
													<Badge className="h-4 border-0 bg-green-500 px-1 text-[9px] hover:bg-green-600">
														已猜对
													</Badge>
												)}
										</div>
									</div>
								))}
						</div>
					</div>
				</div>

				{/* B. 中间：画布区域 (自适应撑满) */}
				<div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
					<div className="z-20 flex h-12 flex-none items-center justify-between border-b border-gray-100 bg-white px-4">
						<div className="flex items-center gap-2 text-sm font-medium text-gray-500">
							<Pencil className="h-4 w-4" /> 画布
						</div>
						{isDrawer && gameState.isActive && (
							<div className="flex items-center gap-3">
								<div className="flex rounded-lg bg-gray-100 p-0.5">
									<Button
										variant={tool === 'pen' ? 'default' : 'ghost'}
										size="icon"
										className={`h-7 w-7 rounded-md ${tool === 'pen' ? 'bg-white text-black shadow-sm' : 'text-gray-500'}`}
										onClick={() => setTool('pen')}
									>
										<Pencil className="h-3.5 w-3.5" />
									</Button>
									<Button
										variant={tool === 'eraser' ? 'default' : 'ghost'}
										size="icon"
										className={`h-7 w-7 rounded-md ${tool === 'eraser' ? 'bg-white text-black shadow-sm' : 'text-gray-500'}`}
										onClick={() => setTool('eraser')}
									>
										<Eraser className="h-3.5 w-3.5" />
									</Button>
								</div>
								<div className="mx-1 h-4 w-px bg-gray-200"></div>
								<input
									type="color"
									value={color}
									onChange={(e) => setColor(e.target.value)}
									className="h-6 w-6 cursor-pointer overflow-hidden rounded border-0 p-0"
									title="选择颜色"
								/>
								<input
									type="range"
									min="1"
									max="20"
									value={size}
									onChange={(e) => setSize(Number(e.target.value))}
									className="h-1.5 w-20 cursor-pointer appearance-none rounded-lg bg-gray-200 accent-black"
									title="笔刷大小"
								/>
								<div className="mx-1 h-4 w-px bg-gray-200"></div>
								<Button
									variant="ghost"
									size="icon"
									className="h-7 w-7 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"
									onClick={handleClearCanvas}
								>
									<RotateCcw className="h-3.5 w-3.5" />
								</Button>
							</div>
						)}
					</div>

					<div className="relative flex-1 cursor-crosshair overflow-hidden bg-white">
						<div className="absolute inset-0">
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
							<div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50/60 backdrop-blur-sm">
								<div className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-lg">
									<Clock className="mx-auto mb-3 h-10 w-10 text-gray-300" />
									<span className="block font-medium text-gray-600">
										等待游戏开始
									</span>
									<span className="mt-1 block text-xs text-gray-400">
										画板已锁定
									</span>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* C. 右侧：聊天与猜测 (lg以上显示, xl以下作为右栏) */}
				<div className="flex w-80 flex-none flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:flex">
					<div className="flex h-12 flex-none items-center justify-between border-b border-gray-100 bg-gray-50/50 px-4">
						<h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
							<MessageSquare className="h-4 w-4" /> 消息
						</h3>
					</div>

					<div
						ref={chatMessagesRef}
						className="flex-1 space-y-3 overflow-y-auto bg-white p-4"
					>
						{chatMessages.length === 0 ? (
							<div className="flex h-full flex-col items-center justify-center text-gray-300">
								<MessageSquare className="mb-2 h-8 w-8 opacity-20" />
								<span className="text-xs">暂无消息</span>
							</div>
						) : (
							chatMessages.map((msg, idx) => (
								<div
									key={idx}
									className={`flex flex-col text-sm ${msg.isSystem ? 'items-center' : ''}`}
								>
									{msg.isSystem ? (
										<span className="my-1 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
											{msg.msg}
										</span>
									) : (
										<div
											className={`flex flex-col ${msg.name === user?.name ? 'items-end' : 'items-start'}`}
										>
											<span className="mb-0.5 px-1 text-[10px] text-gray-400">
												{msg.name}
											</span>
											<div
												className={`overflow-wrap-anywhere max-w-[90%] rounded-2xl px-3 py-1.5 text-xs ${msg.name === user?.name ? 'rounded-tr-none bg-black text-white' : 'rounded-tl-none bg-gray-100 text-gray-800'}`}
											>
												{msg.msg}
											</div>
										</div>
									)}
								</div>
							))
						)}
					</div>

					{gameState.isActive && (
						<div className="flex-none border-t border-gray-100 bg-gray-50 p-3">
							<div className="relative">
								<Input
									placeholder={isDrawer ? '和大家聊聊...' : '输入答案...'}
									value={guessInput}
									onChange={(e) => setGuessInput(e.target.value)}
									onKeyDown={(e) =>
										e.key === 'Enter' &&
										(isDrawer ? handleSendChat() : handleSubmitGuess())
									}
									className="h-9 border-gray-200 bg-white pr-10 text-sm focus-visible:ring-1 focus-visible:ring-gray-400"
								/>
								<button
									onClick={isDrawer ? handleSendChat : handleSubmitGuess}
									disabled={!guessInput.trim()}
									className="absolute top-1 right-1 p-1.5 text-gray-400 transition-colors hover:text-black disabled:opacity-30"
								>
									<Send className="h-4 w-4" />
								</button>
							</div>
							<div className="mt-2 text-center text-[10px] text-gray-400">
								{isDrawer ? '画者只能聊天，不能猜词' : '直接输入答案即可提交'}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
