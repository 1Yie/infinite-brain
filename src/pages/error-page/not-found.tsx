import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export function NotFoundPage() {
	const navigate = useNavigate();

	return (
		<div className="flex min-h-screen items-center justify-center bg-gray-50">
			<div className="text-center">
				<div className="mb-8">
					<h1 className="text-9xl font-bold text-gray-300">404</h1>
					<h2 className="mt-4 text-2xl font-semibold text-gray-700">
						页面未找到
					</h2>
					<p className="mt-2 text-gray-500">
						抱歉，您访问的页面不存在或已被移动。
					</p>
				</div>
				<div className="flex justify-center gap-4">
					<Button
						onClick={() => navigate(-1)}
						variant="outline"
						className="flex items-center gap-2"
					>
						<ArrowLeft className="h-4 w-4" />
						返回上一页
					</Button>
					<Button
						onClick={() => navigate('/')}
						className="flex items-center gap-2"
					>
						<Home className="h-4 w-4" />
						返回首页
					</Button>
				</div>
			</div>
		</div>
	);
}
