import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useWebSocket } from '../../hooks/use-websocket';
import type { StrokeData } from '../../types/whiteboard';
import { useAuth } from '../../context/auth-context';
import { WhiteboardSidebar } from './whiteboard-sidebar';
import { WhiteboardToolbar } from './whiteboard-toolbar';
import { WhiteboardCanvas } from './whiteboard-canvas';
import type { WhiteboardCanvasHandle, DrawData } from './whiteboard-canvas';
import { roomApi, type Room } from '../../api/room';
import {
	AlertDialog,
	AlertDialogClose,
	AlertDialogDescription,
	AlertDialogPopup,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function Whiteboard({ roomId: roomIdProp }: { roomId?: string }) {
	const params = useParams<{ roomId: string }>();

	// 优先级：props > URL params > fallback 默认
	const roomId = roomIdProp ?? params.roomId ?? 'default-room';

	const canvasRef = useRef<WhiteboardCanvasHandle>(null);

	const [currentColor, setCurrentColor] = useState('#000000');
	const [currentSize, setCurrentSize] = useState(5);
	const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
	const [coords, setCoords] = useState({ x: 0, y: 0 });
	const [scale, setScale] = useState(1);

	const [, setRoomInfo] = useState<Room | null>(null);
	const [isChecking, setIsChecking] = useState(true);
	const [password, setPassword] = useState('');
	const [showPasswordDialog, setShowPasswordDialog] = useState(false);
	const [authorized, setAuthorized] = useState(false);
	const [isCanvasLoading, setIsCanvasLoading] = useState(true);

	const { isLogged, user } = useAuth();
	const {
		isConnected,
		isConnecting,
		userId,
		userCount,
		sendDraw,
		sendStrokeFinish,
		onMessage,
		sendUndo,
		sendRedo,
		// sendClear
	} = useWebSocket(authorized && isLogged === true, roomId);

	useEffect(() => {
		const checkRoomAccess = async () => {
			// 先检查 sessionStorage 是否已授权
			if (sessionStorage.getItem(`room_auth_${roomId}`)) {
				setAuthorized(true);
				setIsChecking(false);
				return;
			}

			try {
				setIsChecking(true);
				const room = await roomApi.joinRoom(roomId);
				setRoomInfo(room);
				setAuthorized(true);
			} catch (error) {
				console.error('房间访问检查失败:', error);
				// 如果失败，可能是需要密码，显示对话框
				setShowPasswordDialog(true);
			} finally {
				setIsChecking(false);
			}
		};

		if (roomId && user) {
			checkRoomAccess();
		}
	}, [roomId, user]);

	useEffect(() => {
		const unsubscribe = onMessage((message) => {
			if (!canvasRef.current) return;

			if (message.type === 'draw') {
				// 他人实时绘制
				if (message.userId !== userId) {
					canvasRef.current.drawRemote(message.data as DrawData);
				}
			} else if (message.type === 'clear') {
				canvasRef.current.clear();
			} else if (message.type === 'history-sync') {
				// 数据库历史同步
				canvasRef.current.syncHistory(message.data as StrokeData[]);
				setIsCanvasLoading(false);
			} else if (message.type === 'connected') {
				// WebSocket连接成功，如果还没有加载完canvas，也隐藏加载状态
				setTimeout(() => setIsCanvasLoading(false), 1000);
			} else if (message.type === 'undo') {
				// 只有当不是自己触发的撤销时，才执行本地撤销
				if (message.userId !== userId) {
					canvasRef.current?.undo();
				}
			} else if (message.type === 'redo') {
				// 重做时，服务器广播恢复的笔画数据，所有客户端都需要添加
				canvasRef.current?.addStroke(message.data as StrokeData);
			}
		});

		return () => unsubscribe();
	}, [userId, onMessage]);

	const handleStrokeFinished = useCallback(
		(stroke: Omit<StrokeData, 'id'>) => {
			if (isConnected) {
				sendStrokeFinish({
					...stroke,
					id: crypto.randomUUID(),
				});
			}
		},
		[isConnected, sendStrokeFinish]
	);

	// 处理撤销
	const handleUndo = useCallback(() => {
		if (!isConnected) return;

		// 1. 本地 Canvas 撤销 (视觉反馈)
		canvasRef.current?.undo();
		// 2. 发送请求给后端 (逻辑撤销)
		sendUndo();
	}, [isConnected, sendUndo]);

	// 处理重做
	const handleRedo = useCallback(() => {
		if (!isConnected) return;

		// 发送重做请求给后端
		sendRedo();
	}, [isConnected, sendRedo]);

	const handleJoinRoom = async () => {
		try {
			const room = await roomApi.joinRoom(roomId, password);
			sessionStorage.setItem(`room_auth_${roomId}`, 'true');
			setRoomInfo(room);
			setShowPasswordDialog(false);
			setPassword('');
			setAuthorized(true);
		} catch (error) {
			alert(error instanceof Error ? error.message : '加入房间失败');
		}
	};

	if (isChecking) {
		return (
			<div className="flex h-screen items-center justify-center">
				<div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent"></div>
			</div>
		);
	}

	if (showPasswordDialog && !authorized) {
		return (
			<div className="flex h-screen items-center justify-center bg-zinc-50">
				<AlertDialog
					open={showPasswordDialog}
					onOpenChange={setShowPasswordDialog}
				>
					<AlertDialogPopup>
						<AlertDialogHeader>
							<AlertDialogTitle>加入私密房间</AlertDialogTitle>
							<AlertDialogDescription>请输入房间密码</AlertDialogDescription>
						</AlertDialogHeader>
						<div className="px-6 py-4">
							<Input
								type="password"
								placeholder="输入密码..."
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter') {
										handleJoinRoom();
									}
								}}
							/>
						</div>
						<AlertDialogFooter>
							<AlertDialogClose>
								<Button variant="outline">取消</Button>
							</AlertDialogClose>
							<Button onClick={handleJoinRoom} className="ml-2">
								加入房间
							</Button>
						</AlertDialogFooter>
					</AlertDialogPopup>
				</AlertDialog>
			</div>
		);
	}

	if (!authorized) {
		return (
			<div className="flex h-screen items-center justify-center">
				<p>无权访问此房间</p>
			</div>
		);
	}

	return (
		<div className="flex h-screen flex-col overflow-hidden bg-gray-100">
			<WhiteboardToolbar
				currentTool={tool}
				setCurrentTool={setTool}
				handleUndo={handleUndo}
				handleRedo={handleRedo}
				currentColor={currentColor}
				setCurrentColor={setCurrentColor}
				currentSize={currentSize}
				setCurrentSize={setCurrentSize}
				isConnected={isConnected}
			/>

			<div className="flex flex-1 overflow-hidden">
				<div className="shrink-0">
					<WhiteboardSidebar
						isConnected={isConnected}
						isConnecting={isConnecting}
						user={user}
						userCount={userCount}
						scale={scale}
						coords={coords}
						roomId={roomId || ''}
					/>
				</div>

				<div className="relative flex-1 overflow-hidden">
					{(isCanvasLoading || isConnecting) && (
						<div className="bg-opacity-75 absolute inset-0 z-10 flex items-center justify-center bg-white">
							<div className="flex flex-col items-center gap-4">
								<div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent"></div>
								<p className="text-sm text-zinc-600">
									{isConnecting ? '连接中...' : '加载画布内容...'}
								</p>
							</div>
						</div>
					)}
					<WhiteboardCanvas
						ref={canvasRef}
						tool={tool}
						color={currentColor}
						size={currentSize}
						roomId={roomId}
						readOnly={!isConnected} // 未连接时只读
						onStrokeFinished={handleStrokeFinished} // 画完一笔
						onRealtimeDraw={sendDraw} // 正在画 (广播)
						onCursorChange={setCoords} // 坐标变化
						onScaleChange={setScale} // 缩放变化
					/>

					{/* {!isConnected && (
						<div className="bg-opacity-10 pointer-events-none absolute inset-0 flex items-center justify-center bg-black">
							<div className="rounded bg-white p-3 opacity-80 shadow">
								正在连接
							</div>
						</div>
					)} */}
				</div>
			</div>
		</div>
	);
}
