import { Elysia } from 'elysia';
import { authRoutes } from './auth';
import { boardRoute, gameRoute } from './ws/';
import { roomRoutes } from './room';
import { viewStateApi } from './view-state';
import { guessDrawRoutes } from './guess-draw';

// 主前缀 /api
export const api = new Elysia({ prefix: '/api' })
	.use(authRoutes)
	.use(roomRoutes)
	.use(boardRoute)
	.use(gameRoute)
	.use(viewStateApi)
	.use(guessDrawRoutes);
