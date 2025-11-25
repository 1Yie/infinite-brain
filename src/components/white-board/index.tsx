import { useEffect, useRef, useState, useCallback } from 'react';
import { useWebSocket } from '../../hooks/use-websocket';
import type { StrokeData } from '../../hooks/use-websocket';
import { useAuth } from '../../context/auth-context';
import { WhiteboardSidebar } from './whiteboard-sidebar';
import { WhiteboardToolbar } from './whiteboard-toolbar';
import { useParams } from 'react-router-dom';
import simplify from 'simplify-js';

// 单个绘制点数据 (本地历史/实时广播用)
interface DrawData {
	x: number;
	y: number;
	color?: string;
	size?: number;
	tool?: string;
	prevX?: number;
	prevY?: number;
}

interface Point {
	x: number;
	y: number;
}

const CANVAS_BG_COLOR = '#f3f4f6';

export function Whiteboard() {
	const { roomId } = useParams<{ roomId: string }>();
	const canvasRef = useRef<HTMLCanvasElement>(null);
	// 虚拟光标 DOM
	const customCursorRef = useRef<HTMLDivElement>(null);

	// --- UI 状态 ---
	const [isDrawing, setIsDrawing] = useState(false);
	const [isDragging, setIsDragging] = useState(false);
	const [currentColor, setCurrentColor] = useState('#000000');
	const [currentSize, setCurrentSize] = useState(5);
	const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
	const [isHovering, setIsHovering] = useState(false);

	// 坐标显示
	const [coords, setCoords] = useState({ x: 0, y: 0 });

	// 画布视图状态
	const [offsetX, setOffsetX] = useState(0);
	const [offsetY, setOffsetY] = useState(0);
	const [scale, setScale] = useState(1);

	// --- Refs (用于高性能读写) ---
	const offsetRef = useRef({ x: 0, y: 0 });
	const scaleRef = useRef(1);
	const drawingHistoryRef = useRef<DrawData[]>([]); // 本地渲染历史

	// 记录当前正在画的一笔的所有原始点 (用于存库)
	const currentStrokePointsRef = useRef<{ x: number; y: number }[]>([]);

	const lastPointRef = useRef<Point | null>(null);
	const lastDragPointRef = useRef<Point | null>(null);

	const { isLogged, user } = useAuth();
	// 解构出 sendStrokeFinish
	const {
		isConnected,
		userId,
		userCount,
		sendDraw,
		// sendClear,
		sendStrokeFinish,
		onMessage,
		sendUndo,
	} = useWebSocket(isLogged === true, roomId);

	// --- 辅助函数 ---

	// 清空画布
	const clearCanvas = useCallback(
		(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
			ctx.save();
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.fillStyle = CANVAS_BG_COLOR;
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.restore();
		},
		[]
	);

	// 重绘历史 (用于缩放/平移)
	const redrawHistory = useCallback((ctx: CanvasRenderingContext2D) => {
		const history = drawingHistoryRef.current;
		if (history.length === 0) return;

		ctx.save();
		ctx.translate(offsetRef.current.x, offsetRef.current.y);
		ctx.scale(scaleRef.current, scaleRef.current);
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';

		history.forEach((data) => {
			if (data.prevX !== undefined && data.prevY !== undefined) {
				ctx.beginPath();
				ctx.moveTo(data.prevX, data.prevY);
				ctx.lineTo(data.x, data.y);
				// 橡皮擦使用背景色覆盖
				ctx.strokeStyle =
					data.tool === 'eraser' ? CANVAS_BG_COLOR : data.color || '#000000';
				// 保持物理宽度，不随缩放变细
				ctx.lineWidth = data.size || 5;
				ctx.stroke();
			}
		});
		ctx.restore();
	}, []);

	// --- 生命周期与事件监听 ---

	// 初始化画布 & Resize
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const setupCanvas = () => {
			const dpr = window.devicePixelRatio || 1;
			const rect = canvas.parentElement?.getBoundingClientRect();
			if (rect) {
				canvas.width = rect.width * dpr;
				canvas.height = rect.height * dpr;
				canvas.style.width = `${rect.width}px`;
				canvas.style.height = `${rect.height}px`;
				ctx.scale(dpr, dpr);
				ctx.fillStyle = CANVAS_BG_COLOR;
				ctx.fillRect(0, 0, rect.width, rect.height);
				ctx.lineCap = 'round';
				ctx.lineJoin = 'round';
				redrawHistory(ctx);
			}
		};
		setupCanvas();

		let resizeTimeout: number;
		const handleResize = () => {
			clearTimeout(resizeTimeout);
			resizeTimeout = window.setTimeout(setupCanvas, 100);
		};
		window.addEventListener('resize', handleResize);

		// WebSocket 消息监听
		const unsubscribe = onMessage((message) => {
			if (message.type === 'draw') {
				// 实时绘制 (他人)
				if (message.userId !== userId) {
					const data = message.data as DrawData;
					if (data.prevX !== undefined && data.prevY !== undefined) {
						ctx.save();
						ctx.translate(offsetRef.current.x, offsetRef.current.y);
						ctx.scale(scaleRef.current, scaleRef.current);
						ctx.beginPath();
						ctx.moveTo(data.prevX, data.prevY);
						ctx.lineTo(data.x, data.y);
						ctx.strokeStyle =
							data.tool === 'eraser'
								? CANVAS_BG_COLOR
								: data.color || '#000000';
						ctx.lineWidth = data.size || 5;
						ctx.lineCap = 'round';
						ctx.lineJoin = 'round';
						ctx.stroke();
						ctx.restore();
						drawingHistoryRef.current.push(data);
					}
				}
			} else if (message.type === 'clear') {
				clearCanvas(ctx, canvas);
				drawingHistoryRef.current = [];
			}
			// ✅ 处理数据库历史记录同步
			else if (message.type === 'history-sync') {
				const historyStrokes = message.data as StrokeData[];

				// 1. 先清空
				clearCanvas(ctx, canvas);
				drawingHistoryRef.current = [];

				// 2. 遍历所有笔画重绘
				historyStrokes.forEach((stroke) => {
					const points = stroke.points;
					if (points.length < 2) return;

					// 直接绘制整条线到 Canvas
					ctx.save();
					ctx.translate(offsetRef.current.x, offsetRef.current.y);
					ctx.scale(scaleRef.current, scaleRef.current);

					ctx.beginPath();
					ctx.moveTo(points[0].x, points[0].y);

					for (let i = 1; i < points.length; i++) {
						const p1 = points[i - 1];
						const p2 = points[i];
						ctx.lineTo(p2.x, p2.y);

						// 将连线拆解回 DrawData 存入本地历史 (为了支持 redrawHistory 的重绘)
						drawingHistoryRef.current.push({
							x: p2.x,
							y: p2.y,
							prevX: p1.x,
							prevY: p1.y,
							color: stroke.color,
							size: stroke.size,
							tool: stroke.tool,
						});
					}

					ctx.strokeStyle =
						stroke.tool === 'eraser' ? CANVAS_BG_COLOR : stroke.color;
					ctx.lineWidth = stroke.size;
					ctx.lineCap = 'round';
					ctx.lineJoin = 'round';
					ctx.stroke();
					ctx.restore();
				});
			}
		});

		return () => {
			window.removeEventListener('resize', handleResize);
			unsubscribe();
		};
	}, [userId, onMessage, clearCanvas, redrawHistory]);

	// 当偏移/缩放变化时重绘
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		clearCanvas(ctx, canvas);
		redrawHistory(ctx);
	}, [offsetX, offsetY, scale, clearCanvas, redrawHistory]);

	// 同步 Refs
	useEffect(() => {
		offsetRef.current = { x: offsetX, y: offsetY };
		scaleRef.current = scale;

		// 强制更新光标大小 (防止缩放时光标不跟手)
		if (customCursorRef.current) {
			const size = Math.max(4, currentSize * scale);
			customCursorRef.current.style.width = `${size}px`;
			customCursorRef.current.style.height = `${size}px`;
		}
	}, [offsetX, offsetY, scale, currentSize]);

	// 停止绘制逻辑 (MouseUp / MouseLeave)
	const stopDrawing = useCallback(() => {
		if (isDrawing) {
			setIsDrawing(false);
			lastPointRef.current = null;
			const ctx = canvasRef.current?.getContext('2d');
			ctx?.beginPath();

			// ✅ 核心：抬笔时，压缩并发送完整数据
			if (currentStrokePointsRef.current.length > 1 && isConnected) {
				const rawPoints = currentStrokePointsRef.current;
				// 路径简化: 1px 容差, 高质量模式
				const optimizedPoints = simplify(rawPoints, 1, true);

				const strokeData = {
					id: crypto.randomUUID(),
					tool,
					color: currentColor,
					size: currentSize,
					points: optimizedPoints,
				};

				// 发送给后端存库
				sendStrokeFinish(strokeData);
				console.log(
					`✅ 笔画保存: ${rawPoints.length} -> ${optimizedPoints.length} pts`
				);
			}
			currentStrokePointsRef.current = []; // 清空 Buffer
		}

		if (isDragging) {
			setIsDragging(false);
			lastDragPointRef.current = null;
		}
	}, [
		isDrawing,
		isDragging,
		isConnected,
		tool,
		currentColor,
		currentSize,
		sendStrokeFinish,
	]);

	// 处理滚轮缩放
	const handleWheel = useCallback(
		(e: React.WheelEvent<HTMLCanvasElement>) => {
			e.preventDefault();
			const rect = canvasRef.current?.getBoundingClientRect();
			if (!rect) return;

			const mouseX = e.clientX - rect.left;
			const mouseY = e.clientY - rect.top;

			const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
			// 缩放范围 0.1 - 50 倍
			const newScale = Math.max(
				0.1,
				Math.min(50, scaleRef.current * zoomFactor)
			);
			const scaleChange = newScale / scaleRef.current;

			const newOffsetX = mouseX - (mouseX - offsetRef.current.x) * scaleChange;
			const newOffsetY = mouseY - (mouseY - offsetRef.current.y) * scaleChange;

			setScale(newScale);
			setOffsetX(newOffsetX);
			setOffsetY(newOffsetY);

			// 手动更新光标
			if (customCursorRef.current) {
				customCursorRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
				const newCursorSize = Math.max(4, currentSize * newScale);
				customCursorRef.current.style.width = `${newCursorSize}px`;
				customCursorRef.current.style.height = `${newCursorSize}px`;
			}
		},
		[currentSize]
	);

	// 全局 MouseUp 监听
	useEffect(() => {
		const handleGlobalMouseUp = () => stopDrawing();
		window.addEventListener('mouseup', handleGlobalMouseUp);
		return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
	}, [stopDrawing]);

	// --- 鼠标操作 ---

	// 1. MouseDown
	const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
		// 左键
		if (e.button === 0) {
			setIsDrawing(true);
			const rect = canvasRef.current?.getBoundingClientRect();
			if (rect) {
				const startX =
					(e.clientX - rect.left - offsetRef.current.x) / scaleRef.current;
				const startY =
					(e.clientY - rect.top - offsetRef.current.y) / scaleRef.current;

				lastPointRef.current = { x: startX, y: startY };
				// 记录起点到 buffer
				currentStrokePointsRef.current = [{ x: startX, y: startY }];
			}
		}
		// 右键
		else if (e.button === 2) {
			setIsDragging(true);
			lastDragPointRef.current = { x: e.clientX, y: e.clientY };
		}
	};

	// 2. MouseMove
	const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
		const rect = canvasRef.current?.getBoundingClientRect();

		// 更新光标位置 (DOM 操作，不重渲染)
		if (customCursorRef.current) {
			customCursorRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
		}

		// 更新坐标显示
		if (rect) {
			const worldX = Math.round(
				(e.clientX - rect.left - offsetRef.current.x) / scaleRef.current
			);
			const worldY = Math.round(
				(e.clientY - rect.top - offsetRef.current.y) / scaleRef.current
			);
			setCoords({ x: worldX, y: worldY });
		}

		// 处理拖拽
		if (isDragging && lastDragPointRef.current) {
			const deltaX = e.clientX - lastDragPointRef.current.x;
			const deltaY = e.clientY - lastDragPointRef.current.y;
			offsetRef.current.x += deltaX;
			offsetRef.current.y += deltaY;
			setOffsetX(offsetRef.current.x);
			setOffsetY(offsetRef.current.y);
			lastDragPointRef.current = { x: e.clientX, y: e.clientY };
			return;
		}

		// 强制检查左键，防止卡住
		if (e.buttons !== 1) {
			stopDrawing();
			return;
		}

		if (
			!isDrawing ||
			!canvasRef.current ||
			!lastPointRef.current ||
			!isConnected
		)
			return;

		const ctx = canvasRef.current.getContext('2d');
		if (!ctx) return;

		// 计算世界坐标
		const x = (e.clientX - rect!.left - offsetRef.current.x) / scaleRef.current;
		const y = (e.clientY - rect!.top - offsetRef.current.y) / scaleRef.current;

		// 本地绘制
		ctx.save();
		ctx.translate(offsetRef.current.x, offsetRef.current.y);
		ctx.scale(scaleRef.current, scaleRef.current);
		ctx.beginPath();
		ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
		ctx.lineTo(x, y);

		ctx.strokeStyle = tool === 'eraser' ? CANVAS_BG_COLOR : currentColor;
		ctx.lineWidth = currentSize;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.stroke();
		ctx.restore();

		const drawData: DrawData = {
			x,
			y,
			prevX: lastPointRef.current.x,
			prevY: lastPointRef.current.y,
			color: currentColor,
			size: currentSize,
			tool,
		};

		// 1. 实时广播
		sendDraw(drawData);
		// 2. 存入本地历史 (用于重绘)
		drawingHistoryRef.current.push(drawData);
		// 3. 存入当前笔画 buffer (用于存库)
		currentStrokePointsRef.current.push({ x, y });

		lastPointRef.current = { x, y };
	};

	const handleUndo = () => {
		if (!isConnected) return;

		// 撤销最后一笔
		const lastStroke = drawingHistoryRef.current.pop();
		if (!lastStroke) return;

		// 清空画布并重绘历史
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		clearCanvas(ctx, canvas);
		redrawHistory(ctx);

		// 发送撤销消息到后端
		sendUndo();
	};

	// const handleClear = () => {
	//   if (!isConnected) return;
	//   const canvas = canvasRef.current;
	//   if (!canvas) return;
	//   const ctx = canvas.getContext("2d");
	//   if (!ctx) return;
	//   clearCanvas(ctx, canvas);
	//   drawingHistoryRef.current = [];
	//     sendClear();
	// };

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
				// handleClear={handleClear}
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

				<div
					className="relative flex-1 overflow-hidden"
					style={{ backgroundColor: CANVAS_BG_COLOR }}
				>
					{/* 虚拟光标 */}
					<div
						ref={customCursorRef}
						className="pointer-events-none fixed top-0 left-0 z-50 rounded-full border border-gray-600"
						style={{
							width: `${Math.max(4, currentSize * scale)}px`,
							height: `${Math.max(4, currentSize * scale)}px`,
							opacity: isHovering && !isDragging && tool === 'eraser' ? 1 : 0,
							backgroundColor: 'rgba(255, 255, 255, 0.2)',
							boxShadow: '0 0 2px rgba(0,0,0,0.3)',
						}}
					/>

					<canvas
						ref={canvasRef}
						onMouseDown={startDrawing}
						onMouseMove={draw}
						onMouseUp={stopDrawing}
						onMouseLeave={() => {
							stopDrawing();
							setIsHovering(false);
						}}
						onMouseEnter={() => setIsHovering(true)}
						onWheel={handleWheel}
						onContextMenu={(e) => e.preventDefault()}
						style={{
							cursor: isDragging
								? 'grabbing'
								: tool === 'eraser'
									? 'none'
									: 'crosshair',
						}}
						className={`block h-full w-full ${
							!isConnected ? 'cursor-not-allowed' : ''
						}`}
					/>
					{!isConnected && (
						<div className="bg-opacity-10 pointer-events-none absolute inset-0 flex items-center justify-center bg-black">
							<div className="rounded bg-white p-3 opacity-80 shadow">
								正在连接...
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
