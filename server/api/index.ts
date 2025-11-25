import { Elysia } from 'elysia';
import { authRoutes } from './auth';
import { websocketRoutes } from './ws';
import { roomRoutes } from './room';

// 主前缀 /api
export const api = new Elysia({ prefix: '/api' })
	.use(authRoutes)
	.use(roomRoutes)
	.use(websocketRoutes);
