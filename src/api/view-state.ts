import { client } from './client';

export interface ViewState {
	offset: { x: number; y: number };
	scale: number;
}

export const viewStateApi = {
	// 获取视图状态
	getViewState: async (roomId: string): Promise<ViewState | null> => {
		try {
			const response = await client.api.board.status({ roomId }).get();
			return response.data;
		} catch (error) {
			console.warn('获取视图状态失败:', error);
			return null;
		}
	},

	// 保存视图状态
	saveViewState: async (
		roomId: string,
		viewState: ViewState
	): Promise<void> => {
		try {
			await client.api.board.status({ roomId }).post(viewState);
		} catch (error) {
			console.warn('保存视图状态失败:', error);
		}
	},
};
