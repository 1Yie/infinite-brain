import { treaty } from '@elysiajs/eden';
import type { App } from '../../server';

export const client = treaty<App>(
	import.meta.env.VITE_API_URL || 'http://localhost:3000',
	{
		fetch: {
			credentials: 'include',
		},
	}
);
