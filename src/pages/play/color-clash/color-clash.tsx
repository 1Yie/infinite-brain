import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from '@/components/ui/dialog';

import { useColorClashWebSocket } from '@/hooks/use-color-clash-websocket';
import {
	type ColorClashGameState,
	type ColorClashPlayer,
	type ColorClashServerMessage,
} from '@/api/color-clash';

import { Users, ArrowLeft, Gamepad2, Clock } from 'lucide-react';

import { useAuth } from '@/context/auth-context';
import { toast } from 'sonner';
import { throttle } from 'lodash';
import { SetTitle } from '@/utils/set-title';
// 绘图更新的数据结构
interface DrawUpdate {
	userId: string; // userId 以便连接轨迹
	x: number;
	y: number;
	color: string;
	size: number;
}

// 颜色画布组件
interface ColorCanvasProps {
	width: number;
	height: number;
	players: ColorClashPlayer[];
	currentPlayer: ColorClashPlayer | null;
	isGameActive: boolean;
	onDraw: (data: { x: number; y: number; color: string; size: number }) => void;
	onMove: (data: { x: number; y: number; color: string; size: number }) => void;
	showPlayerList?: boolean;
	currentPlayerId?: string;
}

function ColorCanvas({
	width,
	height,
	players,
	currentPlayer,
	isGameActive,
	onMove,
	showPlayerList = false,
	currentPlayerId,
}: ColorCanvasProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

	// 按键状态
	const [keys, setKeys] = useState({
		w: false,
		a: false,
		s: false,
		d: false,
		up: false,
		left: false,
		down: false,
		right: false,
	});

	// 本地玩家位置 Ref
	const localPlayerPosRef = useRef({ x: width / 2, y: height / 2 });
	// 记录上一帧本地玩家绘制的位置，用于连线
	const lastLocalDrawPosRef = useRef<{ x: number; y: number } | null>(null);

	const hasInitializedPosRef = useRef(false);

	// 记录所有远程玩家上一次绘制的位置，用于连线 { userId: {x, y} }
	const lastRemoteDrawPosMapRef = useRef<Map<string, { x: number; y: number }>>(
		new Map()
	);

	const drawingHistoryRef = useRef<DrawUpdate[]>([]);
	const playersRenderPositionsRef = useRef<
		Map<string, { x: number; y: number }>
	>(new Map());
	const renderFrameIdRef = useRef<number | null>(null);

	// 网络请求节流
	const throttledMoveRef = useRef(
		throttle((data: { x: number; y: number; color: string; size: number }) => {
			onMove(data);
		}, 0)
	);

	// 辅助函数：绘制线条
	const drawLine = (
		ctx: CanvasRenderingContext2D,
		start: { x: number; y: number },
		end: { x: number; y: number },
		color: string,
		size: number
	) => {
		ctx.beginPath();
		ctx.lineCap = 'round'; // 圆头，保证线条连接处平滑
		ctx.lineJoin = 'round';
		ctx.lineWidth = size * 2; // size 是半径，lineWidth 是直径
		ctx.strokeStyle = color;
		ctx.moveTo(start.x, start.y);
		ctx.lineTo(end.x, end.y);
		ctx.stroke();
		// 补一个圆心，防止只有单点时画不出来
		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.arc(end.x, end.y, size, 0, Math.PI * 2);
		ctx.fill();
	};

	// 初始化画布
	useEffect(() => {
		const canvas = canvasRef.current;
		const overlayCanvas = overlayCanvasRef.current;
		if (!canvas || !overlayCanvas) return;

		const ctx = canvas.getContext('2d');
		const overlayCtx = overlayCanvas.getContext('2d');
		if (!ctx || !overlayCtx) return;

		const dpr = window.devicePixelRatio || 1;
		canvas.width = width * dpr;
		canvas.height = height * dpr;
		overlayCanvas.width = width * dpr;
		overlayCanvas.height = height * dpr;

		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;
		overlayCanvas.style.width = `${width}px`;
		overlayCanvas.style.height = `${height}px`;

		ctx.scale(dpr, dpr);
		overlayCtx.scale(dpr, dpr);

		ctx.fillStyle = 'white';
		ctx.fillRect(0, 0, width, height);
		overlayCtx.clearRect(0, 0, width, height);

		drawingHistoryRef.current = [];
		lastRemoteDrawPosMapRef.current.clear();
		lastLocalDrawPosRef.current = null;
	}, [width, height]);

	// Canvas Reset
	useEffect(() => {
		const handleCanvasReset = () => {
			const canvas = canvasRef.current;
			const overlayCanvas = overlayCanvasRef.current;
			if (!canvas || !overlayCanvas) return;
			const ctx = canvas.getContext('2d');
			const overlayCtx = overlayCanvas.getContext('2d');
			if (!ctx || !overlayCtx) return;
			ctx.fillStyle = 'white';
			ctx.fillRect(0, 0, width, height);
			overlayCtx.clearRect(0, 0, width, height);
			drawingHistoryRef.current = [];
			lastRemoteDrawPosMapRef.current.clear();
			lastLocalDrawPosRef.current = null;
		};
		window.addEventListener('canvas-reset', handleCanvasReset);
		return () => window.removeEventListener('canvas-reset', handleCanvasReset);
	}, [width, height]);

	// 监听远程绘制事件
	useEffect(() => {
		const handleRemoteDraw = (e: Event) => {
			const event = e as CustomEvent;
			const { userId, x, y, color, size } = event.detail;
			const canvas = canvasRef.current;
			if (canvas) {
				const ctx = canvas.getContext('2d');
				if (ctx) {
					const lastPos = lastRemoteDrawPosMapRef.current.get(userId);
					if (lastPos) {
						drawLine(ctx, lastPos, { x, y }, color, size);
					} else {
						ctx.fillStyle = color;
						ctx.beginPath();
						ctx.arc(x, y, size, 0, Math.PI * 2);
						ctx.fill();
					}
					lastRemoteDrawPosMapRef.current.set(userId, { x, y });
				}
			}
		};
		window.addEventListener('remote-draw', handleRemoteDraw);
		return () => window.removeEventListener('remote-draw', handleRemoteDraw);
	}, []);

	// 初始化位置
	useEffect(() => {
		if (isGameActive && currentPlayer && !hasInitializedPosRef.current) {
			const startX = currentPlayer.x ?? width / 2;
			const startY = currentPlayer.y ?? height / 2;
			localPlayerPosRef.current = { x: startX, y: startY };
			lastLocalDrawPosRef.current = { x: startX, y: startY }; // 初始化绘图起点
			hasInitializedPosRef.current = true;
		}
		if (!isGameActive) {
			hasInitializedPosRef.current = false;
			lastLocalDrawPosRef.current = null;
		}
	}, [isGameActive, currentPlayer, width, height]);

	// 键盘监听
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (!isGameActive || !currentPlayer) return;
			const key = e.key.toLowerCase();
			if (['w', 'arrowup'].includes(key))
				setKeys((p) => ({ ...p, w: true, up: true }));
			if (['a', 'arrowleft'].includes(key))
				setKeys((p) => ({ ...p, a: true, left: true }));
			if (['s', 'arrowdown'].includes(key))
				setKeys((p) => ({ ...p, s: true, down: true }));
			if (['d', 'arrowright'].includes(key))
				setKeys((p) => ({ ...p, d: true, right: true }));
		};
		const handleKeyUp = (e: KeyboardEvent) => {
			const key = e.key.toLowerCase();
			if (['w', 'arrowup'].includes(key))
				setKeys((p) => ({ ...p, w: false, up: false }));
			if (['a', 'arrowleft'].includes(key))
				setKeys((p) => ({ ...p, a: false, left: false }));
			if (['s', 'arrowdown'].includes(key))
				setKeys((p) => ({ ...p, s: false, down: false }));
			if (['d', 'arrowright'].includes(key))
				setKeys((p) => ({ ...p, d: false, right: false }));
		};
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('keyup', handleKeyUp);
		};
	}, [isGameActive, currentPlayer]);

	// 服务器位置同步
	useEffect(() => {
		if (!currentPlayer) return;
		const dist = Math.sqrt(
			Math.pow((currentPlayer.x || 0) - localPlayerPosRef.current.x, 2) +
				Math.pow((currentPlayer.y || 0) - localPlayerPosRef.current.y, 2)
		);
		// 阈值，防止抽搐
		const threshold = 1000;
		if (dist > threshold) {
			const newPos = {
				x: currentPlayer.x ?? localPlayerPosRef.current.x,
				y: currentPlayer.y ?? localPlayerPosRef.current.y,
			};
			localPlayerPosRef.current = newPos;
			lastLocalDrawPosRef.current = newPos; // 重置绘图起点
		}

		players.forEach((player) => {
			if (player.userId === currentPlayer.userId) return;
			const targetX = player.x ?? Math.floor(width / 2);
			const targetY = player.y ?? Math.floor(height / 2);
			const current = playersRenderPositionsRef.current.get(player.userId) || {
				x: targetX,
				y: targetY,
			};

			if (
				Math.sqrt(
					Math.pow(targetX - current.x, 2) + Math.pow(targetY - current.y, 2)
				) > threshold
			) {
				playersRenderPositionsRef.current.set(player.userId, {
					x: targetX,
					y: targetY,
				});
				// 重置该玩家的连线起点，避免跨屏拉线
				lastRemoteDrawPosMapRef.current.set(player.userId, {
					x: targetX,
					y: targetY,
				});
			}
		});
	}, [players, currentPlayer, width, height]);

	// 主游戏循环
	useEffect(() => {
		if (!isGameActive) return;

		const animate = () => {
			// 本地移动逻辑
			if (currentPlayer) {
				const currentX = localPlayerPosRef.current.x;
				const currentY = localPlayerPosRef.current.y;
				let deltaX = 0;
				let deltaY = 0;
				const moveSpeed = 1.2; // 降低速度

				if (keys.w || keys.up) deltaY -= moveSpeed;
				if (keys.s || keys.down) deltaY += moveSpeed;
				if (keys.a || keys.left) deltaX -= moveSpeed;
				if (keys.d || keys.right) deltaX += moveSpeed;

				if (deltaX !== 0 || deltaY !== 0) {
					const newX = Math.max(0, Math.min(width, currentX + deltaX));
					const newY = Math.max(0, Math.min(height, currentY + deltaY));

					// 更新位置 Ref
					localPlayerPosRef.current = { x: newX, y: newY };

					// 本地立即绘制连续线条
					const ctx = canvasRef.current?.getContext('2d');
					if (ctx && lastLocalDrawPosRef.current) {
						drawLine(
							ctx,
							lastLocalDrawPosRef.current,
							{ x: newX, y: newY },
							currentPlayer.color,
							8 // size
						);
					}
					lastLocalDrawPosRef.current = { x: newX, y: newY };

					// 发送网络请求 (仅发送坐标点)
					throttledMoveRef.current({
						x: newX,
						y: newY,
						color: currentPlayer.color,
						size: 8,
					});
				}
			}

			// 远程玩家位置更新 (直接使用服务器位置，提高响应性)
			players.forEach((player) => {
				if (currentPlayer && player.userId === currentPlayer.userId) return;
				const targetX = player.x ?? width / 2;
				const targetY = player.y ?? height / 2;

				// 直接更新位置而不是插值，提高响应性
				playersRenderPositionsRef.current.set(player.userId, {
					x: targetX,
					y: targetY,
				});
			});

			// 绘制 Overlay (头像/光标)
			const overlayCtx = overlayCanvasRef.current?.getContext('2d');
			if (overlayCtx) {
				overlayCtx.clearRect(0, 0, width, height);
				players.forEach((player) => {
					let renderPos;
					if (currentPlayer && player.userId === currentPlayer.userId) {
						renderPos = localPlayerPosRef.current;
					} else {
						// 使用缓存的位置而不是直接计算
						const cachedPos = playersRenderPositionsRef.current.get(
							player.userId
						);
						renderPos = cachedPos || {
							x: player.x ?? width / 2,
							y: player.y ?? height / 2,
						};
					}

					if (renderPos) {
						overlayCtx.fillStyle = player.color;
						overlayCtx.beginPath();
						overlayCtx.arc(renderPos.x, renderPos.y, 8, 0, Math.PI * 2);
						overlayCtx.fill();
						overlayCtx.strokeStyle = '#000';
						overlayCtx.lineWidth = 2;
						overlayCtx.beginPath();
						overlayCtx.arc(renderPos.x, renderPos.y, 8, 0, Math.PI * 2);
						overlayCtx.stroke();
					}
				});
			}
			renderFrameIdRef.current = requestAnimationFrame(animate);
		};

		renderFrameIdRef.current = requestAnimationFrame(animate);
		return () => {
			if (renderFrameIdRef.current)
				cancelAnimationFrame(renderFrameIdRef.current);
		};
	}, [isGameActive, currentPlayer, keys, width, height, players]);

	return (
		<div
			className="relative h-full overflow-hidden rounded-lg border-2 border-gray-300 p-4"
			style={{
				backgroundImage:
					'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.05) 10px, rgba(0,0,0,0.05) 20px)',
			}}
		>
			<canvas
				ref={canvasRef}
				width={width}
				height={height}
				className="cursor-default"
				style={{
					position: 'absolute',
					top: '50%',
					left: '50%',
					transform: 'translate(-50%, -50%)',
					border: '1px solid #d1d5db',
				}}
			/>
			<canvas
				ref={overlayCanvasRef}
				width={width}
				height={height}
				style={{
					position: 'absolute',
					top: '50%',
					left: '50%',
					transform: 'translate(-50%, -50%)',
					pointerEvents: 'none',
					border: '1px solid #d1d5db',
				}}
			/>
			{showPlayerList && (
				<div className="absolute top-4 right-4 z-10">
					<div className="w-42 rounded-lg border border-gray-200 bg-white/90 shadow-sm backdrop-blur-sm">
						<div className="rounded-t-lg border-b border-gray-100 bg-gray-50/50 px-3 py-2">
							<h3 className="text-xs font-semibold text-gray-700">玩家列表</h3>
						</div>
						<div className="max-h-48 overflow-y-auto p-3">
							<div className="space-y-1">
								{players
									.filter((player) => player.isConnected)
									.map((player) => (
										<div
											key={player.userId}
											className={`flex items-center gap-2 rounded p-1.5 text-xs ${player.userId === currentPlayerId ? 'bg-blue-100' : 'bg-gray-50'}`}
										>
											<div
												className="h-3 w-3 shrink-0 rounded-full border border-gray-300"
												style={{ backgroundColor: player.color }}
											/>
											<span className="flex-1 truncate">{player.username}</span>
											<span className="font-mono text-gray-500">
												{player.score}
											</span>
										</div>
									))}
							</div>
						</div>
					</div>
				</div>
			)}
			{!isGameActive && (
				<div className="bg-opacity-50 absolute inset-0 flex items-center justify-center bg-white">
					<div className="flex items-center gap-2 text-xl font-bold text-gray-800">
						<Clock className="h-6 w-6" />
						等待游戏开始...
					</div>
				</div>
			)}
		</div>
	);
}

export function ColorClash() {
	const { roomId } = useParams<{ roomId: string }>();
	const navigate = useNavigate();
	const { user } = useAuth();
	const [gameState, setGameState] = useState<ColorClashGameState | null>(null);
	const [timeLeft, setTimeLeft] = useState<number | null>(null);
	const [gameEndDialog, setGameEndDialog] = useState<{
		open: boolean;
		title: string;
		description: string;
	}>({
		open: false,
		title: '',
		description: '',
	});

	// 使用 WebSocket Hook
	const colorClashWs = useColorClashWebSocket(!!roomId && !!user, roomId);

	// 格式化时间显示
	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	};
	const currentPlayer =
		gameState?.players.find((p) => String(p.userId) === String(user?.id)) ||
		null;

	const handleWebSocketMessage = useCallback(
		(message: ColorClashServerMessage) => {
			switch (message.type) {
				case 'room-joined':
					if (!message.room) {
						toast.error('房间数据加载失败');
						return;
					}
					setGameState({
						mode: 'color-clash',
						isActive: false,
						gameStartTime: null,
						gameTimeLimit: message.room.gameTime,
						players: message.players,
						canvasWidth: message.room.canvasWidth,
						canvasHeight: message.room.canvasHeight,
						colorData: null,
						winner: null,
						gameEndTime: null,
						room: message.room,
					});
					break;
				case 'player-joined':
					setGameState((prev) =>
						prev
							? {
									...prev,
									players: prev.players.some(
										(p) => p.userId === message.player.userId
									)
										? prev.players
										: [...prev.players, message.player],
								}
							: null
					);
					break;
				case 'player-left':
					setGameState((prev) =>
						prev
							? {
									...prev,
									players: prev.players.filter(
										(p) => p.userId !== message.userId
									),
								}
							: null
					);
					break;
				case 'game-started': {
					setGameState(message.gameState);
					toast.success('游戏开始！');
					const canvas = document.querySelector('canvas');
					if (canvas)
						window.dispatchEvent(
							new CustomEvent('canvas-reset', {
								detail: { width: canvas.width, height: canvas.height },
							})
						);
					break;
				}
				case 'draw-update': {
					const { x, y, color, size } = message.data;
					setGameState((prev) => {
						if (!prev) return prev;
						return {
							...prev,
							players: prev.players.map((p) =>
								p.userId === message.userId ? { ...p, x, y } : p
							),
						};
					});
					// 触发远程绘制事件
					window.dispatchEvent(
						new CustomEvent('remote-draw', {
							detail: { userId: message.userId, x, y, color, size },
						})
					);
					break;
				}
				case 'score-update':
					setGameState((prev) =>
						prev
							? {
									...prev,
									players: prev.players.map((p) => {
										const update = message.scores.find(
											(s) => s.userId === p.userId
										);
										return update ? { ...p, score: update.score } : p;
									}),
								}
							: null
					);
					break;
				case 'game-ended':
					setGameState((prev) =>
						prev
							? {
									...prev,
									isActive: false,
									winner: message.winner?.userId || null,
								}
							: null
					);
					if (message.finalScores?.length) {
						const scoreText = message.finalScores
							.sort((a, b) => b.score - a.score)
							.map((p, i) => `${i + 1}. ${p.username}: ${p.score}分`)
							.join('\n');
						setGameEndDialog({
							open: true,
							title: '游戏结束！',
							description: `最终得分：\n${scoreText}`,
						});
					} else {
						setGameEndDialog({
							open: true,
							title: '游戏结束！',
							description: `获胜者：${message.winner?.username || '平局'}`,
						});
					}
					break;
				case 'game-state':
					if (message.data) setGameState(message.data);
					break;
				case 'owner-changed':
					setGameState((prev) =>
						prev
							? {
									...prev,
									room: prev.room
										? {
												...prev.room,
												ownerId: message.newOwnerId,
												ownerName: message.newOwnerName,
											}
										: prev.room,
								}
							: null
					);
					toast.info(`房主已变更为 ${message.newOwnerName}`);
					break;
				case 'error':
					toast.error(message.message);
					break;
			}
		},
		[]
	);

	// 订阅 WebSocket 消息
	useEffect(() => {
		const unsubscribe = colorClashWs.onMessage(
			(message: ColorClashServerMessage) => {
				handleWebSocketMessage(message);
			}
		);
		return () => unsubscribe();
	}, [colorClashWs, handleWebSocketMessage]);

	// 处理倒计时逻辑
	useEffect(() => {
		let interval: NodeJS.Timeout | null = null;

		if (gameState?.isActive && gameState.gameStartTime) {
			interval = setInterval(() => {
				const elapsed = Math.floor(
					(Date.now() - gameState.gameStartTime!) / 1000
				);
				const remaining = Math.max(0, gameState.gameTimeLimit - elapsed);
				setTimeLeft(remaining);

				// 如果时间到了，清除定时器
				if (remaining <= 0 && interval) {
					clearInterval(interval);
				}
			}, 1000);
		}

		return () => {
			if (interval) clearInterval(interval);
		};
	}, [gameState?.isActive, gameState?.gameStartTime, gameState?.gameTimeLimit]);

	const handleDraw = useCallback(
		(data: { x: number; y: number; color: string; size: number }) => {
			if (!colorClashWs.isConnected) return;
			colorClashWs.sendDraw(data);
		},
		[colorClashWs]
	);
	const handleMove = useCallback(
		(data: { x: number; y: number; color: string; size: number }) => {
			if (!colorClashWs.isConnected || !user) return;

			// 本地立即更新玩家位置
			setGameState((prev) =>
				prev
					? {
							...prev,
							players: prev.players.map((p) =>
								String(p.userId) === String(user.id)
									? { ...p, x: data.x, y: data.y }
									: p
							),
						}
					: null
			);

			// 发送到服务器
			colorClashWs.sendDraw(data);
		},
		[colorClashWs, user]
	);
	const handleStartGame = useCallback(() => {
		if (!colorClashWs.isConnected) return;
		if (!gameState || gameState.players.length < 2) {
			toast.error('需要至少 2 名玩家才能开始游戏');
			return;
		}
		colorClashWs.sendGameStart();
	}, [colorClashWs, gameState]);

	if (!gameState) {
		return (
			<div className="flex h-screen items-center justify-center">
				<div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent"></div>
			</div>
		);
	}
	const isOwner = String(gameState.room?.ownerId) === String(user?.id);
	return (
		<div className="flex h-screen w-full flex-col overflow-hidden bg-gray-50">
			<SetTitle title={`颜色对抗 - 房间 ${roomId}`} />

			<header className="sticky top-0 z-10 border-b bg-white px-4 py-3 sm:px-6 lg:px-8">
				<div className="mx-auto flex max-w-7xl items-center justify-between">
					<div className="flex items-center gap-4">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => navigate('/room/color-clash')}
							className="text-gray-600"
						>
							<ArrowLeft className="mr-1 h-4 w-4" /> 返回房间
						</Button>
						<div className="flex items-center gap-2 border-l pl-4">
							<Gamepad2 className="h-5 w-5 text-gray-900" />
							<h1 className="text-lg font-bold text-gray-900">颜色对抗</h1>
							<Badge
								variant="outline"
								className="px-2 py-1 font-mono text-xs text-gray-700"
							>
								{roomId}
							</Badge>
						</div>
					</div>

					<div className="flex items-center gap-3">
						{gameState.isActive && timeLeft !== null && (
							<div className="rounded bg-blue-100 px-2 py-1 font-mono text-sm font-bold text-blue-800">
								{formatTime(timeLeft)}
							</div>
						)}
						<Badge
							variant={colorClashWs.isConnected ? 'default' : 'destructive'}
							className="px-2 py-1 transition-colors"
						>
							{colorClashWs.isConnected ? '在线' : '离线'}
						</Badge>
						<div className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-sm text-gray-600">
							<Users className="h-3 w-3" />
							<span>{gameState.players.length}</span>
						</div>
						{!gameState.isActive && isOwner && (
							<Button
								size="sm"
								className="bg-black text-white hover:bg-gray-800"
								onClick={handleStartGame}
							>
								开始游戏
							</Button>
						)}
					</div>
				</div>
			</header>

			<div className="m-4 flex flex-1 overflow-hidden">
				{/* 画布区域 */}
				<div className="flex-1 overflow-hidden">
					<div className="h-full">
						<ColorCanvas
							width={gameState.canvasWidth}
							height={gameState.canvasHeight}
							players={gameState.players}
							currentPlayer={currentPlayer}
							isGameActive={gameState.isActive}
							onDraw={handleDraw}
							onMove={handleMove}
							showPlayerList={true}
							currentPlayerId={user?.id.toString() || ''}
						/>
					</div>
				</div>
			</div>

			{/* 游戏结束对话框 */}
			<Dialog
				open={gameEndDialog.open}
				onOpenChange={(open) =>
					!open && setGameEndDialog({ open: false, title: '', description: '' })
				}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{gameEndDialog.title}</DialogTitle>
						<DialogDescription className="whitespace-pre-line">
							{gameEndDialog.description}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							onClick={() =>
								setGameEndDialog({ open: false, title: '', description: '' })
							}
							variant="outline"
						>
							确定
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
