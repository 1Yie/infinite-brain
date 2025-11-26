import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useWebSocket } from '../../hooks/use-websocket';
import type { StrokeData } from '../../types/whiteboard';
import { useAuth } from '../../context/auth-context';
import { WhiteboardSidebar } from './whiteboard-sidebar';
import { WhiteboardToolbar } from './whiteboard-toolbar';
import { WhiteboardCanvas } from './whiteboard-canvas';
import type { WhiteboardCanvasHandle, DrawData } from './whiteboard-canvas';

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

	const { isLogged, user } = useAuth();
	const {
		isConnected,
		userId,
		userCount,
		sendDraw,
		sendStrokeFinish,
		onMessage,
		sendUndo,
		// sendClear
	} = useWebSocket(isLogged === true, roomId);

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
			} else if (message.type === 'undo') {
				canvasRef.current.undo();
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

	return (
		<div className="flex h-screen flex-col overflow-hidden bg-gray-100">
			<WhiteboardToolbar
				tool={tool}
				setTool={setTool}
				handleUndo={handleUndo}
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
						user={user}
						userCount={userCount}
						scale={scale}
						coords={coords}
						roomId={roomId || ''}
					/>
				</div>

				<div className="relative flex-1 overflow-hidden">
					<WhiteboardCanvas
						ref={canvasRef}
						tool={tool}
						color={currentColor}
						size={currentSize}
						readOnly={!isConnected} // 未连接时只读
						onStrokeFinished={handleStrokeFinished} // 画完一笔
						onRealtimeDraw={sendDraw} // 正在画 (广播)
						onCursorChange={setCoords} // 坐标变化
						onScaleChange={setScale} // 缩放变化
					/>

					{!isConnected && (
						<div className="bg-opacity-10 pointer-events-none absolute inset-0 flex items-center justify-center bg-black">
							<div className="rounded bg-white p-3 opacity-80 shadow">
								正在连接
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
