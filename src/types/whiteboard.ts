export type ToolType = 'pen' | 'eraser';

export interface StrokeData {
	id: string;
	tool: ToolType;
	color: string;
	size: number;
	points: { x: number; y: number }[];
	createdAt: Date;
	userId: string;
}
