import { Elysia } from 'elysia';
import { authRoutes } from './auth';
import { boardRoute, gameRoute, colorClashWsRoute } from './ws/';
import { boardRoutes } from './board';
import { viewStateApi } from './view-state';
import { guessDrawRoutes } from './guess-draw';
import { colorClashRoutes } from './color-clash';

// 主前缀 /api
export const api = new Elysia({ prefix: '/api' })
	.use(authRoutes)
	.use(boardRoutes)
	.use(boardRoute)
	.use(gameRoute)
	.use(colorClashWsRoute)
	.use(viewStateApi)
	.use(guessDrawRoutes)
	.use(colorClashRoutes);
