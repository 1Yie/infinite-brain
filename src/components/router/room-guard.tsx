import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { guessDrawApi } from '@/api/guess-draw';
import { colorClashApi } from '@/api/color-clash';
import { boardApi } from '@/api/board';
import { Loader2 } from 'lucide-react';

type RoomType = 'whiteboard' | 'guess-draw' | 'color-clash';

interface RoomGuardProps {
	children: React.ReactNode;
	type: RoomType;
}

/**
 * 房间守卫组件 - 根据房间类型检查房间是否存在，不存在则重定向到大厅
 */
export function RoomGuard({ children, type }: RoomGuardProps) {
	const { roomId } = useParams<{ roomId: string }>();
	const navigate = useNavigate();
	const [isChecking, setIsChecking] = useState(true);
	const [isValid, setIsValid] = useState(false);

	useEffect(() => {
		if (!roomId) {
			navigate('/room');
			return;
		}

		const checkRoom = async () => {
			try {
				const apiMap: Record<RoomType, () => Promise<boolean>> = {
					'guess-draw': () =>
						guessDrawApi.getRoomState(roomId).then((r) => !!r.success),
					'color-clash': () =>
						colorClashApi.getRoom(roomId).then((r) => !!r.success),
					whiteboard: () => boardApi.getRoom(roomId).then((r) => !!r),
				};

				const isRoomValid = await apiMap[type]().catch(() => false);

				if (isRoomValid) {
					setIsValid(true);
				} else {
					navigate('/not-found');
				}
			} catch {
				navigate('/not-found');
			} finally {
				setIsChecking(false);
			}
		};

		checkRoom();
	}, [roomId, navigate, type]);

	if (isChecking) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<Loader2 className="mx-auto h-8 w-8 animate-spin" />
			</div>
		);
	}

	if (!isValid) {
		return null;
	}

	return <>{children}</>;
}
