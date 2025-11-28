import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../layout/app-layout';
import { AuthProvider } from '../context/auth-context';
import { RequireAuth, AnonymousOnly } from '../components/router/auth-guard';
import { Whiteboard } from '../pages/board-room/white-board';
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
import { WhiteboardPage } from '../pages/board-room';
import { SettingsPage } from '@/pages/settings';
import { FunctionDocsPage } from '@/pages/docs/function';
import { ConnectDocsPage } from '@/pages/docs/support/connect';
import { HelpDocsPage } from '@/pages/docs/support/help';

export const router = createBrowserRouter([
	{
		path: '/',
		element: (
			<AuthProvider>
				<SetTitle title="Infinite Brain - 释放你的创造力" />
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
				path: 'settings',
				element: (
					<>
						<SetTitle title="Infinite Brain - 设置" />
						<SettingsPage />
					</>
				),
			},
			{
				path: 'room',
				element: (
					<>
						<SetTitle title="Infinite Brain - 房间列表" />
						<RoomPage />
					</>
				),
			},
			{
				path: 'room/whiteboard',
				element: (
					<>
						<WhiteboardPage />
					</>
				),
			},
			{
				path: 'room/whiteboard/:roomId',
				element: (
					<>
						<Whiteboard />
					</>
				),
			},
			{
				path: 'room/guess-draw',
				element: (
					<>
						<SetTitle title="你猜我画 - 房间列表" />
						<GuessDrawLobby />
					</>
				),
			},
			{
				path: 'room/guess-draw/create',
				element: (
					<>
						<SetTitle title="创建你猜我画房间" />
						<CreateGuessDrawRoom />
					</>
				),
			},
			{
				path: 'room/guess-draw/:roomId',
				element: (
					<RoomGuard>
						<GuessDrawPage />
					</RoomGuard>
				),
			},
		],
	},

	{
		path: '/product/function',
		element: (
			<AuthProvider>
				<SetTitle title="Infinite Brain - 功能文档" />
				<FunctionDocsPage />
			</AuthProvider>
		),
	},

	{
		path: '/support/connect',
		element: (
			<AuthProvider>
				<SetTitle title="Infinite Brain - 连接支持" />
				<ConnectDocsPage />
			</AuthProvider>
		),
	},
	{
		path: '/support/help',
		element: (
			<AuthProvider>
				<SetTitle title="Infinite Brain - 帮助支持" />
				<HelpDocsPage />
			</AuthProvider>
		),
	},

	{
		path: '/login',
		element: (
			<AuthProvider>
				<SetTitle title="Infinite Brain - 登录" />
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
				<SetTitle title="Infinite Brain - 注册" />
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
