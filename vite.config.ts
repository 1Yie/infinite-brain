import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import removeConsole from 'vite-plugin-remove-console';
import path from 'path';

export default defineConfig(({ mode }) => ({
	plugins: [
		react({
			babel: {
				plugins: [['babel-plugin-react-compiler']],
			},
		}),
		tailwindcss(),
		...(mode === 'production' ? [removeConsole()] : []),
	],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},

	build: {
		minify: 'esbuild',
		esbuild: {
			drop: mode === 'production' ? ['console', 'debugger'] : [],
		},
	},
}));
