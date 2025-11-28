import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { guessDrawApi } from '@/api/guess-draw';
import { Loader2 } from 'lucide-react';

interface RoomGuardProps {
	children: React.ReactNode;
}

/**
 * 房间守卫组件 - 检查房间是否存在，不存在则重定向到大厅
 */
export function RoomGuard({ children }: RoomGuardProps) {
	const { roomId } = useParams<{ roomId: string }>();
	const navigate = useNavigate();
	const [isChecking, setIsChecking] = useState(true);
	const [isValid, setIsValid] = useState(false);

	useEffect(() => {
		if (!roomId) {
			navigate('/room/guess-draw');
			return;
		}

		const checkRoom = async () => {
			try {
				const response = await guessDrawApi.getRoomState(roomId);
				if (response.success) {
					setIsValid(true);
				} else {
					// 房间不存在，跳转到 404 页面
					navigate('/not-found');
				}
			} catch {
				// API 调用失败（404等），跳转到 404 页面
				navigate('/not-found');
			} finally {
				setIsChecking(false);
			}
		};

		checkRoom();
	}, [roomId, navigate]);

	if (isChecking) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader2 className="mx-auto h-8 w-8 animate-spin" />
			</div>
		);
	}

	if (!isValid) {
		return null; // 不会渲染，因为会重定向
	}

	return <>{children}</>;
}
