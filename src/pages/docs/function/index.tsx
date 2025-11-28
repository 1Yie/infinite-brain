import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export function FunctionDocsPage() {
	const navigate = useNavigate();

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900">
			{/* 顶部导航栏 */}
			<header className="sticky top-0 z-10 border-b bg-white px-4 py-3 sm:px-6 lg:px-8 dark:bg-gray-800">
				<div className="mx-auto flex max-w-7xl items-center justify-between">
					<div className="flex items-center gap-4">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => navigate('/')}
							className="text-gray-600 dark:text-gray-400"
						>
							<ArrowLeft className="mr-1 h-4 w-4" /> 返回首页
						</Button>
						<div className="flex items-center gap-2 border-l pl-4">
							<svg
								className="h-5 w-5 text-gray-900 dark:text-gray-100"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								/>
							</svg>
							<h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
								功能
							</h1>
						</div>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
				<div className="prose dark:prose-invert max-w-none space-y-6"></div>
			</main>
		</div>
	);
}
