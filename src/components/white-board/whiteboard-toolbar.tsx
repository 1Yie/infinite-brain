import React from 'react';

interface WhiteboardToolbarProps {
	tool: 'pen' | 'eraser';
	setTool: (tool: 'pen' | 'eraser') => void;
	currentColor: string;
	setCurrentColor: (color: string) => void;
	currentSize: number;
	setCurrentSize: (size: number) => void;
	handleUndo: () => void;
	isConnected: boolean;
}

const COLORS = [
	'#000000',
	'#FF0000',
	'#00FF00',
	'#0000FF',
	'#FFFF00',
	'#FF00FF',
	'#00FFFF',
];

export const WhiteboardToolbar: React.FC<WhiteboardToolbarProps> = ({
	tool,
	setTool,
	currentColor,
	setCurrentColor,
	currentSize,
	setCurrentSize,
	handleUndo,
	isConnected,
}) => {
	return (
		<div className="z-10 shrink-0 border-b border-gray-200 bg-white px-6 py-3">
			<div className="flex items-center gap-6">
				{/* 工具选择 */}
				<div className="flex gap-1 rounded-lg bg-gray-100 p-1">
					<button
						onClick={() => setTool('pen')}
						className={`rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 ${
							tool === 'pen'
								? 'bg-white text-blue-600 shadow-sm'
								: 'text-gray-600 hover:text-gray-900'
						}`}
					>
						<svg
							className="mr-1.5 inline-block h-4 w-4"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
							/>
						</svg>
						画笔
					</button>
					<button
						onClick={() => setTool('eraser')}
						className={`rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 ${
							tool === 'eraser'
								? 'bg-white text-blue-600 shadow-sm'
								: 'text-gray-600 hover:text-gray-900'
						}`}
					>
						<svg
							className="mr-1.5 inline-block h-4 w-4"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
							/>
						</svg>
						橡皮
					</button>
				</div>

				<div className="h-8 w-px bg-gray-300"></div>

				{/* 颜色选择 */}
				<div className="flex items-center gap-3">
					<span className="text-xs font-medium tracking-wider text-gray-500 uppercase">
						颜色
					</span>
					<div className="flex gap-2">
						{COLORS.map((color) => {
							const colorClasses = {
								'#000000': 'bg-black',
								'#FF0000': 'bg-red-500',
								'#00FF00': 'bg-green-500',
								'#0000FF': 'bg-blue-500',
								'#FFFF00': 'bg-yellow-400',
								'#FF00FF': 'bg-pink-500',
								'#00FFFF': 'bg-cyan-400',
							};

							return (
								<button
									key={color}
									onClick={() => setCurrentColor(color)}
									title={`颜色: ${color}`}
									className={`h-7 w-7 rounded-lg transition-all duration-200 ${
										colorClasses[color as keyof typeof colorClasses] || ''
									} ${
										currentColor === color
											? 'scale-110 ring-2 ring-blue-500 ring-offset-2'
											: 'opacity-80 hover:scale-105 hover:opacity-100'
									}`}
								/>
							);
						})}

						{/* 自定义颜色选择器 */}
						<div className="relative ml-1">
							<input
								type="color"
								value={currentColor}
								onChange={(e) => setCurrentColor(e.target.value)}
								className="absolute inset-0 z-10 h-7 w-7 cursor-pointer rounded-lg border-2 border-gray-300"
								title="选择自定义颜色"
							/>
							<div
								className="pointer-events-none flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border-2 border-gray-300 transition-colors hover:border-gray-400"
								style={{ backgroundColor: currentColor }}
							>
								<svg
									className="h-4 w-4 text-white drop-shadow"
									fill="currentColor"
									viewBox="0 0 20 20"
								>
									<path
										fillRule="evenodd"
										d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
										clipRule="evenodd"
									/>
								</svg>
							</div>
						</div>
					</div>
				</div>

				<div className="h-8 w-px bg-gray-300"></div>

				{/* 大小选择 */}
				<div className="flex items-center gap-3">
					<span className="text-xs font-medium tracking-wider text-gray-500 uppercase">
						大小
					</span>
					<input
						type="range"
						min="1"
						max="50"
						value={currentSize}
						onChange={(e) => setCurrentSize(Number(e.target.value))}
						className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-gray-200 accent-blue-500"
						title={`画笔大小: ${currentSize}`}
					/>
					<input
						type="number"
						min="1"
						max="50"
						value={currentSize}
						onChange={(e) => setCurrentSize(Number(e.target.value))}
						className="w-14 rounded-lg border border-gray-300 px-2 py-1 text-center text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
						title="输入画笔大小"
					/>
				</div>

				<div className="ml-auto"></div>

				{/* 清空按钮 */}
				{/* <button
          onClick={handleClear}
          className="px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
          disabled={!isConnected}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          清空画布
        </button> */}

				{/* 撤销按钮 */}
				<button
					onClick={handleUndo}
					className="flex items-center gap-2 rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-800 transition-all duration-200 hover:bg-gray-300"
					disabled={!isConnected}
				>
					<svg
						className="h-4 w-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M7 16l-4-4m0 0l4-4m-4 4h18"
						/>
					</svg>
					撤销
				</button>
			</div>
		</div>
	);
};
