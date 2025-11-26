import {
	useEffect,
	useRef,
	useState,
	useCallback,
	useImperativeHandle,
	forwardRef,
} from 'react';
import simplify from 'simplify-js';

// --- 类型定义 ---
export interface Point {
	x: number;
	y: number;
}

export interface DrawData {
	x: number;
	y: number;
	color?: string;
	size?: number;
	tool?: string;
	prevX?: number;
	prevY?: number;
}

export interface StrokeData {
	id: string;
	tool: 'pen' | 'eraser';
	color: string;
	size: number;
	points: Point[];
}

interface WhiteboardCanvasProps {
	// 状态输入
	tool: 'pen' | 'eraser';
	color: string;
	size: number;
	readOnly?: boolean; // 是否只读

	// 事件回调
	onStrokeFinished?: (stroke: Omit<StrokeData, 'id'>) => void; // 笔画结束（存库）
	onRealtimeDraw?: (data: DrawData) => void; // 实时绘制（广播）
	onCursorChange?: (coords: { x: number; y: number }) => void; // 坐标更新
	onScaleChange?: (scale: number) => void; // 缩放更新
}

// 暴露给父组件的方法
export interface WhiteboardCanvasHandle {
	drawRemote: (data: DrawData) => void;
	syncHistory: (strokes: StrokeData[]) => void;
	undo: () => void;
	clear: () => void;
	resetView: () => void; // 重置缩放/平移
}

const CANVAS_BG_COLOR = '#f3f4f6';

export const WhiteboardCanvas = forwardRef<
	WhiteboardCanvasHandle,
	WhiteboardCanvasProps
>(
	(
		{
			tool,
			color,
			size,
			readOnly = false,
			onStrokeFinished,
			onRealtimeDraw,
			onCursorChange,
			onScaleChange,
		},
		ref
	) => {
		const canvasRef = useRef<HTMLCanvasElement>(null);
		const customCursorRef = useRef<HTMLDivElement>(null);

		// --- 内部状态 ---
		const [isDrawing, setIsDrawing] = useState(false);
		const [isDragging, setIsDragging] = useState(false);
		const [isHovering, setIsHovering] = useState(false);

		// 视图状态 (为了性能，主要逻辑依赖 Refs，State 用于触发重绘或 UI 更新)
		const [scale, setScale] = useState(1);
		const offsetRef = useRef({ x: 0, y: 0 });
		const scaleRef = useRef(1);

		// 数据记录
		const drawingHistoryRef = useRef<DrawData[]>([]); // 本地渲染历史 (像素点)
		const currentStrokePointsRef = useRef<{ x: number; y: number }[]>([]); // 当前笔画原始点
		const lastPointRef = useRef<Point | null>(null);
		const lastDragPointRef = useRef<Point | null>(null);

		// --- 核心方法 ---

		// 1. 清空画布
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

		// 2. 重绘历史 (用于缩放/平移/撤销)
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
					ctx.strokeStyle =
						data.tool === 'eraser' ? CANVAS_BG_COLOR : data.color || '#000000';
					ctx.lineWidth = data.size || 5;
					ctx.stroke();
				}
			});
			ctx.restore();
		}, []);

		// 3. 暴露给父组件的方法
		useImperativeHandle(ref, () => ({
			// 远程实时绘制
			drawRemote: (data: DrawData) => {
				const canvas = canvasRef.current;
				const ctx = canvas?.getContext('2d');
				if (!canvas || !ctx || !data.prevX || !data.prevY) return;

				ctx.save();
				ctx.translate(offsetRef.current.x, offsetRef.current.y);
				ctx.scale(scaleRef.current, scaleRef.current);
				ctx.beginPath();
				ctx.moveTo(data.prevX, data.prevY);
				ctx.lineTo(data.x, data.y);
				ctx.strokeStyle =
					data.tool === 'eraser' ? CANVAS_BG_COLOR : data.color || '#000000';
				ctx.lineWidth = data.size || 5;
				ctx.lineCap = 'round';
				ctx.lineJoin = 'round';
				ctx.stroke();
				ctx.restore();

				// 加入本地历史以支持缩放重绘
				drawingHistoryRef.current.push(data);
			},

			// 同步完整历史 (数据库加载)
			syncHistory: (strokes: StrokeData[]) => {
				const canvas = canvasRef.current;
				const ctx = canvas?.getContext('2d');
				if (!canvas || !ctx) return;

				clearCanvas(ctx, canvas);
				drawingHistoryRef.current = [];

				strokes.forEach((stroke) => {
					const points = stroke.points;
					if (points.length < 2) return;

					// 绘制到 Canvas
					ctx.save();
					ctx.translate(offsetRef.current.x, offsetRef.current.y);
					ctx.scale(scaleRef.current, scaleRef.current);
					ctx.beginPath();
					ctx.moveTo(points[0].x, points[0].y);

					for (let i = 1; i < points.length; i++) {
						const p1 = points[i - 1];
						const p2 = points[i];
						ctx.lineTo(p2.x, p2.y);

						// 拆解回 DrawData 存入本地历史
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
			},

			// 撤销
			undo: () => {
				// 这里的 undo 是粗略实现 (基于点的)，更好的 undo 是基于 stroke 的
				// 简单实现：移除最后一段绘制数据 (实际生产中通常需要移除一整笔)
				// 建议父组件控制 History Stack，这里只负责渲染
				// 但为了兼容现有逻辑：
				const lastStroke = drawingHistoryRef.current.pop();
				if (!lastStroke) return;

				const canvas = canvasRef.current;
				const ctx = canvas?.getContext('2d');
				if (canvas && ctx) {
					clearCanvas(ctx, canvas);
					redrawHistory(ctx);
				}
			},

			clear: () => {
				const canvas = canvasRef.current;
				const ctx = canvas?.getContext('2d');
				if (canvas && ctx) {
					clearCanvas(ctx, canvas);
					drawingHistoryRef.current = [];
				}
			},

			resetView: () => {
				offsetRef.current = { x: 0, y: 0 };
				scaleRef.current = 1;
				setScale(1);
				// 触发重绘
				const canvas = canvasRef.current;
				const ctx = canvas?.getContext('2d');
				if (canvas && ctx) {
					clearCanvas(ctx, canvas);
					redrawHistory(ctx);
				}
			},
		}));

		// --- 生命周期 ---

		// 初始化 & Resize
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

			return () => window.removeEventListener('resize', handleResize);
		}, [redrawHistory]);

		// 更新光标大小
		useEffect(() => {
			if (customCursorRef.current) {
				const cursorSize = Math.max(4, size * scale);
				customCursorRef.current.style.width = `${cursorSize}px`;
				customCursorRef.current.style.height = `${cursorSize}px`;
			}
		}, [size, scale]);

		// --- 交互处理 ---

		const stopDrawing = useCallback(() => {
			if (isDrawing) {
				setIsDrawing(false);
				lastPointRef.current = null;

				// 笔画结束，压缩并传回父组件
				if (currentStrokePointsRef.current.length > 1 && onStrokeFinished) {
					const rawPoints = currentStrokePointsRef.current;
					const optimizedPoints = simplify(rawPoints, 1, true);

					onStrokeFinished({
						tool,
						color,
						size,
						points: optimizedPoints,
					});
				}
				currentStrokePointsRef.current = [];
			}

			if (isDragging) {
				setIsDragging(false);
				lastDragPointRef.current = null;
			}
		}, [isDrawing, isDragging, onStrokeFinished, tool, color, size]);

		// 全局 MouseUp
		useEffect(() => {
			window.addEventListener('mouseup', stopDrawing);
			return () => window.removeEventListener('mouseup', stopDrawing);
		}, [stopDrawing]);

		const handleWheel = useCallback(
			(e: React.WheelEvent<HTMLCanvasElement>) => {
				e.preventDefault();
				const rect = canvasRef.current?.getBoundingClientRect();
				if (!rect) return;

				const mouseX = e.clientX - rect.left;
				const mouseY = e.clientY - rect.top;

				const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
				const newScale = Math.max(
					0.1,
					Math.min(50, scaleRef.current * zoomFactor)
				);
				const scaleChange = newScale / scaleRef.current;

				const newOffsetX =
					mouseX - (mouseX - offsetRef.current.x) * scaleChange;
				const newOffsetY =
					mouseY - (mouseY - offsetRef.current.y) * scaleChange;

				// 更新 Ref (即时)
				scaleRef.current = newScale;
				offsetRef.current.x = newOffsetX;
				offsetRef.current.y = newOffsetY;

				// 更新 State (触发 React 更新，如光标)
				setScale(newScale);
				if (onScaleChange) onScaleChange(newScale);

				// 重绘 Canvas
				const ctx = canvasRef.current?.getContext('2d');
				if (canvasRef.current && ctx) {
					clearCanvas(ctx, canvasRef.current);
					redrawHistory(ctx);
				}

				// 更新光标位置
				if (customCursorRef.current) {
					customCursorRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
				}
			},
			[clearCanvas, redrawHistory, onScaleChange, size]
		);

		const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
			// 右键拖拽
			if (e.button === 2) {
				setIsDragging(true);
				lastDragPointRef.current = { x: e.clientX, y: e.clientY };
				return;
			}

			// 左键绘制 (如果不是只读)
			if (e.button === 0 && !readOnly) {
				setIsDrawing(true);
				const rect = canvasRef.current?.getBoundingClientRect();
				if (rect) {
					const startX =
						(e.clientX - rect.left - offsetRef.current.x) / scaleRef.current;
					const startY =
						(e.clientY - rect.top - offsetRef.current.y) / scaleRef.current;

					lastPointRef.current = { x: startX, y: startY };
					currentStrokePointsRef.current = [{ x: startX, y: startY }];
				}
			}
		};

		const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
			const rect = canvasRef.current?.getBoundingClientRect();

			// 1. 光标 & 坐标计算
			if (customCursorRef.current) {
				customCursorRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
			}

			if (rect && onCursorChange) {
				const worldX = Math.round(
					(e.clientX - rect.left - offsetRef.current.x) / scaleRef.current
				);
				const worldY = Math.round(
					(e.clientY - rect.top - offsetRef.current.y) / scaleRef.current
				);
				onCursorChange({ x: worldX, y: worldY });
			}

			// 2. 拖拽逻辑
			if (isDragging && lastDragPointRef.current) {
				const deltaX = e.clientX - lastDragPointRef.current.x;
				const deltaY = e.clientY - lastDragPointRef.current.y;

				offsetRef.current.x += deltaX;
				offsetRef.current.y += deltaY;

				// 重绘
				const ctx = canvasRef.current?.getContext('2d');
				if (canvasRef.current && ctx) {
					clearCanvas(ctx, canvasRef.current);
					redrawHistory(ctx);
				}

				lastDragPointRef.current = { x: e.clientX, y: e.clientY };
				return;
			}

			// 3. 绘制逻辑
			if (e.buttons !== 1) {
				stopDrawing(); // 防卡死
				return;
			}

			if (!isDrawing || !canvasRef.current || !lastPointRef.current || readOnly)
				return;

			const ctx = canvasRef.current.getContext('2d');
			if (!ctx || !rect) return;

			const x =
				(e.clientX - rect.left - offsetRef.current.x) / scaleRef.current;
			const y = (e.clientY - rect.top - offsetRef.current.y) / scaleRef.current;

			// 绘制到 Canvas
			ctx.save();
			ctx.translate(offsetRef.current.x, offsetRef.current.y);
			ctx.scale(scaleRef.current, scaleRef.current);
			ctx.beginPath();
			ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
			ctx.lineTo(x, y);

			ctx.strokeStyle = tool === 'eraser' ? CANVAS_BG_COLOR : color;
			ctx.lineWidth = size;
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';
			ctx.stroke();
			ctx.restore();

			const drawData: DrawData = {
				x,
				y,
				prevX: lastPointRef.current.x,
				prevY: lastPointRef.current.y,
				color,
				size,
				tool,
			};

			// 本地存储
			drawingHistoryRef.current.push(drawData);
			currentStrokePointsRef.current.push({ x, y });

			// 回调广播
			if (onRealtimeDraw) onRealtimeDraw(drawData);

			lastPointRef.current = { x, y };
		};

		// Add an event listener to prevent the default behavior of wheel events on the canvas.
		useEffect(() => {
			const handleWheel = (event: WheelEvent) => {
				event.preventDefault();
			};

			const canvasElement = canvasRef.current;
			if (canvasElement) {
				canvasElement.addEventListener('wheel', handleWheel);
			}

			return () => {
				if (canvasElement) {
					canvasElement.removeEventListener('wheel', handleWheel);
				}
			};
		}, []);

		return (
			<div
				className="relative h-full w-full overflow-hidden"
				style={{ backgroundColor: CANVAS_BG_COLOR }}
			>
				{/* 虚拟光标 */}
				<div
					ref={customCursorRef}
					className="pointer-events-none fixed top-0 left-0 z-50 rounded-full border border-gray-600"
					style={{
						width: '20px', // 初始值，会被 effect 覆盖
						height: '20px',
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
					className={`block h-full w-full ${readOnly ? 'cursor-default' : ''}`}
				/>
			</div>
		);
	}
);

WhiteboardCanvas.displayName = 'WhiteboardCanvas';
