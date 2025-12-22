import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react"
import { type ReactNode, useState } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface LeftSidebarTab {
	id: string
	label: string
	content: ReactNode
}

interface EditorLayoutProps {
	/** Left sidebar content (slides list) - use this OR leftSidebarTabs */
	leftSidebar?: ReactNode
	/** Left sidebar tabs - use this OR leftSidebar */
	leftSidebarTabs?: LeftSidebarTab[]
	/** Right sidebar content (properties panel) */
	rightSidebar?: ReactNode
	/** Main content (canvas area) */
	children: ReactNode
	/** Title for left sidebar header (only used when leftSidebar is provided, not tabs) */
	leftSidebarTitle?: string
	/** Right sidebar title */
	rightSidebarTitle?: string
}

export function EditorLayout({
	leftSidebar,
	leftSidebarTabs,
	rightSidebar,
	children,
	leftSidebarTitle = "Slides",
	rightSidebarTitle = "Properties",
}: EditorLayoutProps) {
	const [leftCollapsed, setLeftCollapsed] = useState(false)
	const [rightCollapsed, setRightCollapsed] = useState(false)

	const hasLeftSidebar = leftSidebar || (leftSidebarTabs && leftSidebarTabs.length > 0)

	return (
		<div className="flex h-screen pt-14">
			{/* Left Sidebar */}
			{hasLeftSidebar && (
				<aside
					className={cn(
						"flex flex-col border-r border-neutral-200 bg-white transition-all duration-200",
						leftCollapsed ? "w-12" : "w-64",
					)}
				>
					{/* Tabbed Left Sidebar */}
					{leftSidebarTabs && leftSidebarTabs.length > 0 ? (
						<>
							{/* Header with collapse button */}
							<div className="flex h-10 shrink-0 items-center justify-end border-b border-neutral-200 px-3">
								<Button
									variant="ghost"
									size="icon"
									className="h-6 w-6"
									onClick={() => setLeftCollapsed(!leftCollapsed)}
								>
									{leftCollapsed ? (
										<PanelLeftOpen className="h-3.5 w-3.5" />
									) : (
										<PanelLeftClose className="h-3.5 w-3.5" />
									)}
								</Button>
							</div>

							{/* Tabs Content */}
							{!leftCollapsed && (
								<Tabs defaultValue={leftSidebarTabs[0]?.id} className="flex flex-1 flex-col">
									<TabsList className="mx-2 mt-2 w-auto">
										{leftSidebarTabs.map((tab) => (
											<TabsTrigger key={tab.id} value={tab.id} className="flex-1 text-xs">
												{tab.label}
											</TabsTrigger>
										))}
									</TabsList>
									{leftSidebarTabs.map((tab) => (
										<TabsContent
											key={tab.id}
											value={tab.id}
											className="mt-0 flex-1 overflow-y-auto"
										>
											{tab.content}
										</TabsContent>
									))}
								</Tabs>
							)}
						</>
					) : (
						<>
							{/* Simple Left Sidebar (original behavior) */}
							<div className="flex h-10 shrink-0 items-center justify-between border-b border-neutral-200 px-3">
								{!leftCollapsed && (
									<span className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">
										{leftSidebarTitle}
									</span>
								)}
								<Button
									variant="ghost"
									size="icon"
									className="h-6 w-6"
									onClick={() => setLeftCollapsed(!leftCollapsed)}
								>
									{leftCollapsed ? (
										<PanelLeftOpen className="h-3.5 w-3.5" />
									) : (
										<PanelLeftClose className="h-3.5 w-3.5" />
									)}
								</Button>
							</div>

							{/* Sidebar Content */}
							{!leftCollapsed && <div className="flex-1 overflow-y-auto">{leftSidebar}</div>}
						</>
					)}
				</aside>
			)}

			{/* Main Content Area */}
			<main className="relative flex-1 overflow-hidden bg-neutral-50">{children}</main>

			{/* Right Sidebar */}
			{rightSidebar && (
				<aside
					className={cn(
						"flex flex-col border-l border-neutral-200 bg-white transition-all duration-200",
						rightCollapsed ? "w-12" : "w-80",
					)}
				>
					{/* Sidebar Header */}
					<div className="flex h-10 shrink-0 items-center justify-between border-b border-neutral-200 px-3">
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6"
							onClick={() => setRightCollapsed(!rightCollapsed)}
						>
							{rightCollapsed ? (
								<PanelRightOpen className="h-3.5 w-3.5" />
							) : (
								<PanelRightClose className="h-3.5 w-3.5" />
							)}
						</Button>
						{!rightCollapsed && (
							<span className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">
								{rightSidebarTitle}
							</span>
						)}
					</div>

					{/* Sidebar Content */}
					{!rightCollapsed && <div className="flex-1 overflow-y-auto">{rightSidebar}</div>}
				</aside>
			)}
		</div>
	)
}

export default EditorLayout
