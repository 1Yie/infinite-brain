import { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api/auth';
import type { User, LoginResponse, LogoutResponse } from '../api/auth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

type AuthContextType = {
	isLogged: boolean | null;
	user: User | null;
	login: (username: string, password: string) => Promise<LoginResponse>;
	logout: () => Promise<LogoutResponse>;
	handleAuthFailure: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [isLogged, setIsLogged] = useState<boolean | null>(null);
	const [user, setUser] = useState<User | null>(null);
	const navigate = useNavigate();

	const handleAuthFailure = () => {
		setIsLogged(false);
		setUser(null);
		navigate('/login');
	};

	useEffect(() => {
		let mounted = true;

		authApi.checkAuth().then((res) => {
			if (mounted) {
				if (res?.success) {
					setIsLogged(true);
					setUser((res as { user?: User })?.user || null);
				} else {
					setIsLogged(false);
					setUser(null);
					// 显示错误消息
					const message = (res as { message?: string })?.message;
					if (message && message !== '未登录') {
						toast.error(message);
					}
				}
			}
		});

		return () => {
			mounted = false;
		};
	}, []);

	const login = async (username: string, password: string) => {
		const response = await authApi.login({ username, password });

		if (response.data && 'user' in response.data) {
			setIsLogged(true);
			setUser(response.data.user as User);
		}

		return response;
	};

	const logout = async () => {
		const response = await authApi.logout();
		setIsLogged(false);
		setUser(null);
		return response;
	};

	return (
		<AuthContext.Provider
			value={{ isLogged, user, login, logout, handleAuthFailure }}
		>
			{children}
		</AuthContext.Provider>
	);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextType {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error('useAuth must be used within AuthProvider');
	return ctx;
}
