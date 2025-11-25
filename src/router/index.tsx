import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../layout/app-layout';
import { AuthProvider } from '../context/auth-context';
import { RequireAuth, AnonymousOnly } from '../components/router/auth-guard';
import { Whiteboard } from '../components/white-board';
import { Login } from '../components/auth/login';
import { Register } from '../components/auth/register';
import { RoomPage } from '../components/room';

export const router = createBrowserRouter([
	{
		path: '/',
		element: (
			<AuthProvider>
				<RequireAuth>
					<AppLayout />
				</RequireAuth>
			</AuthProvider>
		),
		children: [
			{
				index: true,
				element: (
					<>
						<RoomPage />
					</>
				),
			},
			{
				path: 'board',
				element: <Navigate to="/" replace />,
			},
			{
				path: 'board/:roomId',
				element: <Whiteboard />,
			},
		],
	},
	{
		path: '/login',
		element: (
			<AuthProvider>
				<AnonymousOnly>
					<Login />
				</AnonymousOnly>
			</AuthProvider>
		),
	},
	{
		path: '/register',
		element: (
			<AuthProvider>
				<AnonymousOnly>
					<Register />
				</AnonymousOnly>
			</AuthProvider>
		),
	},
]);
