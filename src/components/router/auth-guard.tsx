import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import { Toaster } from 'sonner';

/**
 * 需要登录才能访问
 */
export function RequireAuth({ children }: { children: React.ReactElement }) {
	const { isLogged } = useAuth();
	const location = useLocation();

	// 初始加载中（检查 cookie 状态）
	if (isLogged === null) {
		return;
	}

	// 未登录 → 跳去登录页
	if (!isLogged) {
		return <Navigate to="/login" state={{ from: location }} replace />;
	}

	return (
		<>
			<Toaster position="top-center" richColors />
			{children}
		</>
	);
}

/**
 * 只能未登录访问（用于登录页）
 */
export function AnonymousOnly({ children }: { children: React.ReactElement }) {
	const { isLogged } = useAuth();

	// 仍在检查 cookie
	if (isLogged === null) {
		return;
	}

	// 已登录 → 不许访问登录页 → 回 room 页
	if (isLogged) {
		return <Navigate to="/room" replace />;
	}

	return (
		<>
			<Toaster position="top-center" richColors />
			{children}
		</>
	);
}
