import {
	useEffect,
	useRef,
	useState,
	useCallback,
	useImperativeHandle,
	forwardRef,
} from 'react';
import simplify from 'simplify-js';
import { useAuth } from '../../context/auth-context';
import { viewStateApi } from '../../api/view-state';

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
	createdAt: Date;
	userId: string;
}

interface WhiteboardCanvasProps {
	// 状态输入
	tool: 'pen' | 'eraser';
	color: string;
	size: number;
	readOnly?: boolean; // 是否只读
	roomId?: string; // 房间ID，用于保存视图状态

	// 事件回调
	onStrokeFinished?: (stroke: StrokeData) => void; // 笔画结束（存库）
	onRealtimeDraw?: (data: DrawData) => void; // 实时绘制（广播）
	onCursorChange?: (coords: { x: number; y: number }) => void; // 坐标更新
	onScaleChange?: (scale: number) => void; // 缩放更新
}

// 暴露给父组件的方法
export interface WhiteboardCanvasHandle {
	drawRemote: (data: DrawData) => void;
	syncHistory: (strokes: StrokeData[]) => void;
	undo: (userId?: string) => string | undefined; // 返回被撤销的笔画ID
	redo: () => void;
	addStroke: (stroke: StrokeData) => void;
	removeStrokeById: (strokeId: string) => void;
	clear: () => void;
	resetView: () => void; // 重置缩放/平移
	getViewState: () => { offset: { x: number; y: number }; scale: number };
	setViewState: (offset: { x: number; y: number }, scale: number) => void;
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
			roomId = 'default',
			onStrokeFinished,
			onRealtimeDraw,
			onCursorChange,
			onScaleChange,
		},
		ref
	) => {
		const canvasRef = useRef<HTMLCanvasElement>(null);
		const customCursorRef = useRef<HTMLDivElement>(null);

		// 尝试获取认证状态，如果没有AuthProvider则使用null
		let user = null;
		try {
			const auth = useAuth();
			user = auth.user;
		} catch (error) {
			// AuthProvider不存在，使用null
			console.warn('AuthProvider not available, using anonymous mode: ', error);
		}

		const [isDrawing, setIsDrawing] = useState(false);
		const [isDragging, setIsDragging] = useState(false);
		const [isHovering, setIsHovering] = useState(false);

		const [scale, setScale] = useState(1);
		const offsetRef = useRef({ x: 0, y: 0 });
		const scaleRef = useRef(1);

		// 数据记录
		const drawingHistoryRef = useRef<DrawData[]>([]); // 本地渲染历史 (像素点)
		const strokeHistoryRef = useRef<StrokeData[]>([]); // 笔画历史 (完整的笔画)
		const currentStrokePointsRef = useRef<{ x: number; y: number }[]>([]); // 当前笔画原始点
		const lastPointRef = useRef<Point | null>(null);
		const lastDragPointRef = useRef<Point | null>(null);
		const getViewStateKey = useCallback(
			() => `whiteboard-view-state-${roomId}`,
			[roomId]
		);

		// 保存视图状态的函数
		const saveViewState = useCallback(async () => {
			const viewState = {
				offset: offsetRef.current,
				scale: scaleRef.current,
			};

			// 总是保存到localStorage作为备份
			localStorage.setItem(getViewStateKey(), JSON.stringify(viewState));

			// 如果用户已登录，同时保存到服务器
			if (user) {
				try {
					await viewStateApi.saveViewState(roomId, viewState);
				} catch (error) {
					console.warn('保存视图状态到服务器失败:', error);
				}
			}
		}, [getViewStateKey, roomId, user]);

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

		useImperativeHandle(ref, () => ({
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

				drawingHistoryRef.current.push(data);
			},

			syncHistory: (strokes: StrokeData[]) => {
				const canvas = canvasRef.current;
				const ctx = canvas?.getContext('2d');
				if (!canvas || !ctx) return;

				clearCanvas(ctx, canvas);
				drawingHistoryRef.current = [];
				strokeHistoryRef.current = strokes;

				strokes.forEach((stroke) => {
					const points = stroke.points;
					if (points.length < 2) return;

					ctx.save();
					ctx.translate(offsetRef.current.x, offsetRef.current.y);
					ctx.scale(scaleRef.current, scaleRef.current);
					ctx.beginPath();
					ctx.moveTo(points[0].x, points[0].y);

					for (let i = 1; i < points.length; i++) {
						const p1 = points[i - 1];
						const p2 = points[i];
						ctx.lineTo(p2.x, p2.y);

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

			undo: (userId?: string) => {
				// 找出最新的笔画（按创建时间排序）
				if (strokeHistoryRef.current.length === 0) return;

				// 按创建时间排序，找出最新的笔画
				const sortedStrokes = [...strokeHistoryRef.current].sort(
					(a, b) =>
						new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
				);

				// 如果提供了userId，只撤销该用户的笔画
				const latestStroke = userId
					? sortedStrokes.find((s) => s.userId === userId)
					: sortedStrokes[0];

				if (!latestStroke) return; // 如果找不到该用户的笔画，则返回

				const strokeId = latestStroke.id;

				// 从本地历史中移除该笔画
				strokeHistoryRef.current = strokeHistoryRef.current.filter(
					(s) => s.id !== strokeId
				);

				// 重建drawingHistoryRef（像素历史）
				drawingHistoryRef.current = [];
				strokeHistoryRef.current.forEach((s) => {
					const points = s.points;
					for (let i = 1; i < points.length; i++) {
						const p1 = points[i - 1];
						const p2 = points[i];
						drawingHistoryRef.current.push({
							x: p2.x,
							y: p2.y,
							prevX: p1.x,
							prevY: p1.y,
							color: s.color,
							size: s.size,
							tool: s.tool,
						});
					}
				});

				// 重绘画布
				const canvas = canvasRef.current;
				const ctx = canvas?.getContext('2d');
				if (!canvas || !ctx) return;

				clearCanvas(ctx, canvas);
				strokeHistoryRef.current.forEach((s) => {
					const points = s.points;
					if (points.length < 2) return;

					ctx.save();
					ctx.translate(offsetRef.current.x, offsetRef.current.y);
					ctx.scale(scaleRef.current, scaleRef.current);
					ctx.beginPath();
					ctx.moveTo(points[0].x, points[0].y);

					for (let i = 1; i < points.length; i++) {
						ctx.lineTo(points[i].x, points[i].y);
					}

					ctx.strokeStyle = s.tool === 'eraser' ? CANVAS_BG_COLOR : s.color;
					ctx.lineWidth = s.size;
					ctx.lineCap = 'round';
					ctx.lineJoin = 'round';
					ctx.stroke();
					ctx.restore();
				});

				// 返回被撤销的笔画ID，供服务器同步使用
				return strokeId;
			},

			redo: () => {
				// 重做最后一个撤销的笔画（由服务器处理）
				// 不需要本地逻辑，服务器会广播重做的数据
			},

			addStroke: (stroke: StrokeData) => {
				console.log(
					`尝试添加笔画ID: ${stroke.id}, 笔画点数: ${stroke.points.length}`
				);
				// 找到正确的插入位置，保持按创建时间排序
				const insertIndex = strokeHistoryRef.current.findIndex(
					(s) => new Date(s.createdAt) > new Date(stroke.createdAt)
				);
				if (insertIndex === -1) {
					// 如果没有找到，说明应该插入到末尾
					strokeHistoryRef.current.push(stroke);
					console.log(`笔画ID: ${stroke.id} 已添加到末尾`);
				} else {
					// 插入到正确位置
					strokeHistoryRef.current.splice(insertIndex, 0, stroke);
					console.log(`笔画ID: ${stroke.id} 已插入到位置 ${insertIndex}`);
				}

				const canvas = canvasRef.current;
				const ctx = canvas?.getContext('2d');
				if (!canvas || !ctx) return;

				// 清除画布
				clearCanvas(ctx, canvas);

				// 重新绘制所有笔画
				strokeHistoryRef.current.forEach((s) => {
					const points = s.points;
					if (points.length < 2) return;

					ctx.save();
					ctx.translate(offsetRef.current.x, offsetRef.current.y);
					ctx.scale(scaleRef.current, scaleRef.current);
					ctx.beginPath();
					ctx.moveTo(points[0].x, points[0].y);

					for (let i = 1; i < points.length; i++) {
						ctx.lineTo(points[i].x, points[i].y);
					}

					ctx.strokeStyle = s.tool === 'eraser' ? CANVAS_BG_COLOR : s.color;
					ctx.lineWidth = s.size;
					ctx.lineCap = 'round';
					ctx.lineJoin = 'round';
					ctx.stroke();
					ctx.restore();
				});

				// 更新drawingHistoryRef以保持同步
				drawingHistoryRef.current = [];
				strokeHistoryRef.current.forEach((s) => {
					const points = s.points;
					for (let i = 1; i < points.length; i++) {
						const p1 = points[i - 1];
						const p2 = points[i];
						drawingHistoryRef.current.push({
							x: p2.x,
							y: p2.y,
							prevX: p1.x,
							prevY: p1.y,
							color: s.color,
							size: s.size,
							tool: s.tool,
						});
					}
				});
			},

			removeStrokeById: (strokeId: string) => {
				console.log(`尝试删除笔画ID: ${strokeId}`);
				// 从笔画历史中按 id 删除指定笔画
				const idx = strokeHistoryRef.current.findIndex(
					(s) => s.id === strokeId
				);
				if (idx === -1) {
					console.log(`笔画ID ${strokeId} 不存在或已删除`);
					return; // 笔画不存在或已删除
				}

				console.log(
					`成功删除笔画ID: ${strokeId}, 当前笔画总数: ${strokeHistoryRef.current.length}`
				);
				strokeHistoryRef.current.splice(idx, 1);

				// 清空并重新构建 drawingHistoryRef（像素历史）
				drawingHistoryRef.current = [];
				strokeHistoryRef.current.forEach((s) => {
					const points = s.points;
					for (let i = 1; i < points.length; i++) {
						const p1 = points[i - 1];
						const p2 = points[i];
						drawingHistoryRef.current.push({
							x: p2.x,
							y: p2.y,
							prevX: p1.x,
							prevY: p1.y,
							color: s.color,
							size: s.size,
							tool: s.tool,
						});
					}
				});

				// 重绘画布
				const canvas = canvasRef.current;
				const ctx = canvas?.getContext('2d');
				if (!canvas || !ctx) return;

				clearCanvas(ctx, canvas);
				strokeHistoryRef.current.forEach((s) => {
					const points = s.points;
					if (points.length < 2) return;

					ctx.save();
					ctx.translate(offsetRef.current.x, offsetRef.current.y);
					ctx.scale(scaleRef.current, scaleRef.current);
					ctx.beginPath();
					ctx.moveTo(points[0].x, points[0].y);

					for (let i = 1; i < points.length; i++) {
						ctx.lineTo(points[i].x, points[i].y);
					}

					ctx.strokeStyle = s.tool === 'eraser' ? CANVAS_BG_COLOR : s.color;
					ctx.lineWidth = s.size;
					ctx.lineCap = 'round';
					ctx.lineJoin = 'round';
					ctx.stroke();
					ctx.restore();
				});
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

				const canvas = canvasRef.current;
				const ctx = canvas?.getContext('2d');
				if (canvas && ctx) {
					clearCanvas(ctx, canvas);
					redrawHistory(ctx);
				}
			},

			getViewState: () => ({
				offset: { ...offsetRef.current },
				scale: scaleRef.current,
			}),

			setViewState: (offset: { x: number; y: number }, scale: number) => {
				offsetRef.current = { ...offset };
				scaleRef.current = scale;
				setScale(scale);

				const canvas = canvasRef.current;
				const ctx = canvas?.getContext('2d');
				if (canvas && ctx) {
					clearCanvas(ctx, canvas);
					redrawHistory(ctx);
				}
			},
		}));

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

					// 恢复视图状态：优先从服务器获取，失败则使用localStorage
					const restoreViewState = async () => {
						let viewState = null;

						// 如果用户已登录，尝试从服务器获取
						if (user) {
							try {
								viewState = await viewStateApi.getViewState(roomId);
							} catch (error) {
								console.warn('从服务器获取视图状态失败:', error);
							}
						}

						// 如果服务器没有数据或未登录，使用localStorage
						if (!viewState) {
							const savedViewState = localStorage.getItem(getViewStateKey());
							if (savedViewState) {
								try {
									viewState = JSON.parse(savedViewState);
								} catch (error) {
									console.warn('从localStorage恢复视图状态失败:', error);
								}
							}
						}

						// 应用视图状态
						if (viewState) {
							offsetRef.current = viewState.offset;
							scaleRef.current = viewState.scale;
							setScale(viewState.scale);
						}
					};

					// 异步恢复视图状态
					restoreViewState().finally(() => {
						redrawHistory(ctx);
					});
				}
			};
			setupCanvas();

			let resizeTimeout: number;
			const handleResize = () => {
				clearTimeout(resizeTimeout);
				resizeTimeout = window.setTimeout(setupCanvas, 100);
			};
			window.addEventListener('resize', handleResize);

			return () => {
				window.removeEventListener('resize', handleResize);
				// 组件卸载时保存视图状态
				saveViewState();
			};
		}, [redrawHistory, getViewStateKey, roomId, user]);

		// 更新光标大小
		useEffect(() => {
			if (customCursorRef.current) {
				const cursorSize = Math.max(4, size * scale);
				customCursorRef.current.style.width = `${cursorSize}px`;
				customCursorRef.current.style.height = `${cursorSize}px`;
			}
		}, [size, scale]);

		const stopDrawing = useCallback(() => {
			if (isDrawing) {
				setIsDrawing(false);
				lastPointRef.current = null;

				// 笔画结束，压缩并传回父组件
				if (currentStrokePointsRef.current.length > 1 && onStrokeFinished) {
					const rawPoints = currentStrokePointsRef.current;
					const optimizedPoints = simplify(rawPoints, 1, true);

					// 生成一个ID，确保本地和服务器使用相同的ID
					const strokeId = crypto.randomUUID();
					const strokeData: StrokeData = {
						id: strokeId,
						tool,
						color,
						size,
						points: optimizedPoints,
						createdAt: new Date(),
						userId: user?.id?.toString() || 'anonymous',
					};

					console.log(
						`创建新笔画，ID: ${strokeData.id}, 点数: ${optimizedPoints.length}`
					);

					// 保存到本地笔画历史
					strokeHistoryRef.current.push(strokeData);

					// 同时更新drawingHistoryRef，确保新笔画可以被正确撤销
					for (let i = 1; i < optimizedPoints.length; i++) {
						const p1 = optimizedPoints[i - 1];
						const p2 = optimizedPoints[i];
						drawingHistoryRef.current.push({
							x: p2.x,
							y: p2.y,
							prevX: p1.x,
							prevY: p1.y,
							color: color,
							size: size,
							tool: tool,
						});
					}

					console.log(
						`笔画已保存到本地历史，当前笔画总数: ${strokeHistoryRef.current.length}`
					);

					// 传递笔画数据和ID给父组件，确保服务器使用相同的ID
					onStrokeFinished(strokeData);
				}
				currentStrokePointsRef.current = [];
			}

			if (isDragging) {
				setIsDragging(false);
				lastDragPointRef.current = null;
			}
		}, [isDrawing, isDragging, onStrokeFinished, tool, color, size]);

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

				scaleRef.current = newScale;
				offsetRef.current.x = newOffsetX;
				offsetRef.current.y = newOffsetY;

				setScale(newScale);
				if (onScaleChange) onScaleChange(newScale);

				const ctx = canvasRef.current?.getContext('2d');
				if (canvasRef.current && ctx) {
					clearCanvas(ctx, canvasRef.current);
					redrawHistory(ctx);
				}

				// 不再在这里保存视图状态，在组件卸载时保存

				if (customCursorRef.current) {
					customCursorRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
				}
			},
			[clearCanvas, redrawHistory, onScaleChange]
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

			// 光标 & 坐标计算
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

			drawingHistoryRef.current.push(drawData);
			currentStrokePointsRef.current.push({ x, y });

			if (onRealtimeDraw) onRealtimeDraw(drawData);

			lastPointRef.current = { x, y };
		};

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
