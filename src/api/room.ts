import { client } from './client';

export interface Room {
	id: string;
	name: string;
	ownerId: string;
	isPrivate?: boolean;
	password?: string;
	createdAt: Date | string | null;
}

export const roomApi = {
	/**
	 * 获取房间列表
	 */
	getRooms: async (): Promise<Room[]> => {
		const { data, error } = await client.api.rooms.get();

		if (error) {
			throw new Error(error.value?.toString() || '获取房间列表失败');
		}

		if (!data.success) {
			throw new Error(data.error || '获取房间列表失败');
		}

		return data.data as Room[];
	},

	/**
	 * 创建房间
	 * @param name 房间名称
	 * @param isPrivate 是否私有
	 * @param password 密码（私有房间）
	 */
	createRoom: async (
		name: string,
		isPrivate?: boolean,
		password?: string
	): Promise<{ roomId: string; name: string }> => {
		const { data, error } = await client.api.rooms.create.post({
			name,
			isPrivate,
			password,
		});

		if (error) {
			throw new Error(error.value?.toString() || '创建房间失败');
		}

		if (!data.success) {
			throw new Error(data.error || '创建房间失败');
		}

		return { roomId: data.roomId!, name: data.name! };
	},

	/**
	 * 删除房间
	 * @param id 房间ID
	 */
	deleteRoom: async (id: string): Promise<boolean> => {
		const { data, error } = await client.api.rooms({ id }).delete();

		if (error) {
			throw new Error(error.value?.toString() || '删除房间失败');
		}

		if (!data.success) {
			throw new Error(data.error || '删除房间失败');
		}

		return true;
	},

	/**
	 * 加入房间
	 * @param roomId 房间ID
	 * @param password 密码（如果需要）
	 */
	joinRoom: async (roomId: string, password?: string): Promise<Room> => {
		const response = await fetch(
			`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/rooms/join`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({ roomId, password }),
			}
		);

		const data = await response.json();

		if (!data.success) {
			throw new Error(data.error || '加入房间失败');
		}

		return data.room as Room;
	},

	/**
	 * 获取用户统计数据
	 */
	getUserStats: async (): Promise<{
		totalStrokes: number;
		todayStrokes: number;
		totalPixels: number;
		todayPixels: number;
	}> => {
		const { data, error } = await client.api.rooms.stats.get();

		if (error) {
			throw new Error(error.value?.toString() || '获取统计数据失败');
		}

		if (!data.success) {
			throw new Error(data.error || '获取统计数据失败');
		}

		return (
			data.data || {
				totalStrokes: 0,
				todayStrokes: 0,
				totalPixels: 0,
				todayPixels: 0,
			}
		);
	},
};
