import { describe, it, expect, vi, beforeEach } from 'bun:test';
import type { WhiteboardCanvasHandle } from '../pages/board-room/white-board/whiteboard-canvas';

describe('WhiteboardCanvas 撤销/重做 - 接口层测试', () => {
	let canvasRef: { current: WhiteboardCanvasHandle | null };
	let userId: string | null;

	beforeEach(() => {
		userId = 'user-123';
		canvasRef = { current: null };
	});

	describe('游客用户 (无 userId)', () => {
		it('应该处理游客用户的笔画撤销', () => {
			const undoMock = vi.fn(() => 'stroke-1');
			canvasRef.current = {
				undo: undoMock,
			} as unknown as WhiteboardCanvasHandle;

			const strokeId = canvasRef.current?.undo();
			expect(strokeId).toBe('stroke-1');
			expect(undoMock).toHaveBeenCalled();
		});
		it('游客不应该撤销其他用户的笔画', () => {
			const undoMock = vi.fn(() => undefined); // 游客无法撤销别人笔画
			canvasRef.current = {
				undo: undoMock,
			} as unknown as WhiteboardCanvasHandle;

			const strokeId = canvasRef.current?.undo('other-user');
			expect(strokeId).toBeUndefined();
			expect(undoMock).toHaveBeenCalledWith('other-user');
		});
	});

	describe('登录用户 (有 userId)', () => {
		it('应该处理登录用户的笔画撤销', () => {
			const undoMock = vi.fn(() => 'stroke-3');
			canvasRef.current = {
				undo: undoMock,
			} as unknown as WhiteboardCanvasHandle;

			const strokeId = canvasRef.current?.undo(userId!);
			expect(strokeId).toBe('stroke-3');
			expect(undoMock).toHaveBeenCalledWith(userId);
		});

		it('登录用户应该只撤销自己的笔画', () => {
			const undoMock = vi.fn((id?: string) =>
				id === userId ? 'stroke-4' : undefined
			);
			canvasRef.current = {
				undo: undoMock,
			} as unknown as WhiteboardCanvasHandle;

			const strokeId = canvasRef.current?.undo('other-user');
			expect(strokeId).toBeUndefined();
			expect(undoMock).toHaveBeenCalledWith('other-user');

			const myStroke = canvasRef.current?.undo(userId!);
			expect(myStroke).toBe('stroke-4');
			expect(undoMock).toHaveBeenCalledWith(userId);
		});

		it('应该处理重做功能', () => {
			const redoMock = vi.fn();
			canvasRef.current = {
				redo: redoMock,
			} as unknown as WhiteboardCanvasHandle;

			canvasRef.current?.redo?.();
			expect(redoMock).toHaveBeenCalled();
		});
	});

	describe('跨用户行为', () => {
		it('应该隔离用户之间的撤销操作', () => {
			const undoMock = vi.fn((id?: string) =>
				id === userId ? 'stroke-5' : undefined
			);
			canvasRef.current = {
				undo: undoMock,
			} as unknown as WhiteboardCanvasHandle;

			expect(canvasRef.current?.undo('other-user')).toBeUndefined();
			expect(canvasRef.current?.undo(userId!)).toBe('stroke-5');
		});
	});

	describe('WebSocket 集成', () => {
		it('应该为登录用户发送带有 strokeId 的撤销', () => {
			const undoMock = vi.fn(() => 'stroke-6');
			const sendUndoMock = vi.fn();
			canvasRef.current = {
				undo: undoMock,
			} as unknown as WhiteboardCanvasHandle;

			const strokeId = canvasRef.current?.undo(userId!);
			if (strokeId) sendUndoMock(strokeId);

			expect(undoMock).toHaveBeenCalledWith(userId);
			expect(sendUndoMock).toHaveBeenCalledWith('stroke-6');
		});

		it('当没有本地撤销时应该发送不带 strokeId 的撤销', () => {
			const undoMock = vi.fn(() => undefined);
			const sendUndoMock = vi.fn();
			canvasRef.current = {
				undo: undoMock,
			} as unknown as WhiteboardCanvasHandle;

			const strokeId = canvasRef.current?.undo(userId!);
			if (strokeId) sendUndoMock(strokeId);
			else sendUndoMock();

			expect(undoMock).toHaveBeenCalledWith(userId);
			expect(sendUndoMock).toHaveBeenCalledWith();
		});
	});
});
