import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../layout/app-layout';
import { AuthProvider } from '../context/auth-context';
import { RequireAuth, AnonymousOnly } from '../components/router/auth-guard';
import { Whiteboard } from '../pages/white-board';
import { Login } from '../pages/auth/login';
import { Register } from '../pages/auth/register';
import { RoomPage } from '../pages/room';
import { HomePage } from '../pages/home';
import { SetTitle } from '@/utils/set-title';
import { GuessDrawLobby } from '../pages/play/guess-draw';
import { CreateGuessDrawRoom } from '../pages/play/guess-draw/create-room';
import { GuessDrawPage } from '../pages/play/guess-draw/guess-draw';
import { NotFoundPage } from '../pages/not-found';
import { RoomGuard } from '../components/router/room-guard';

export const router = createBrowserRouter([
	{
		path: '/',
		element: (
			<AuthProvider>
				<SetTitle title="Infinite Board - 无限画布" />
				<HomePage />
			</AuthProvider>
		),
	},

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
				path: 'room',
				element: (
					<>
						<SetTitle title="Infinite Board - 房间列表" />
						<RoomPage />
					</>
				),
			},
			{
				path: 'room/:roomId',
				element: (
					<>
						<Whiteboard />
					</>
				),
			},
			{
				path: 'play/guess-draw',
				element: (
					<>
						<SetTitle title="你猜我画 - 房间列表" />
						<GuessDrawLobby />
					</>
				),
			},
			{
				path: 'play/guess-draw/create',
				element: (
					<>
						<SetTitle title="创建你猜我画房间" />
						<CreateGuessDrawRoom />
					</>
				),
			},
			{
				path: 'play/guess-draw/:roomId',
				element: (
					<RoomGuard>
						<GuessDrawPage />
					</RoomGuard>
				),
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
	{
		path: '*',
		element: (
			<AuthProvider>
				<NotFoundPage />
			</AuthProvider>
		),
	},
]);
