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
import { GuessDrawLobby } from '../pages/play';
import { CreateGuessDrawRoom } from '../pages/play/create-room';
import { JoinGuessDrawRoom } from '../pages/play/join-room';
import { GuessDrawPage } from '../pages/play/guess-draw';

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
				path: 'play/guess-draw/join',
				element: (
					<>
						<SetTitle title="加入你猜我画房间" />
						<JoinGuessDrawRoom />
					</>
				),
			},
			{
				path: 'play/guess-draw/:roomId',
				element: (
					<>
						<GuessDrawPage />
					</>
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
]);
