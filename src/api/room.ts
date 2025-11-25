import { client } from './client';

export interface Room {
	id: string;
	name: string;
	ownerId: string;
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
	 */
	createRoom: async (
		name: string
	): Promise<{ roomId: string; name: string }> => {
		const { data, error } = await client.api.rooms.create.post({
			name,
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
};
