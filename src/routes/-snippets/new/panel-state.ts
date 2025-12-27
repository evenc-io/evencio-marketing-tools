const PANEL_STATE_KEY = "evencio.snippets.new.panel-state"

export type PanelState = {
	detailsCollapsed: boolean
	explorerCollapsed: boolean
	examplesOpen: boolean
	importsOpen: boolean
}

export type PanelSnapshot = Pick<PanelState, "detailsCollapsed" | "explorerCollapsed">

export const readPanelState = (): PanelState | null => {
	if (typeof window === "undefined") return null
	try {
		const raw = window.localStorage.getItem(PANEL_STATE_KEY)
		if (!raw) return null
		const parsed = JSON.parse(raw) as Partial<PanelState>
		if (!parsed || typeof parsed !== "object") return null
		const keys = Object.keys(parsed)
		const allowedKeys = new Set([
			"detailsCollapsed",
			"explorerCollapsed",
			"examplesOpen",
			"importsOpen",
		])
		if (keys.some((key) => !allowedKeys.has(key))) return null
		if (typeof parsed.detailsCollapsed !== "boolean") return null
		if (typeof parsed.explorerCollapsed !== "boolean") return null
		const examplesOpen =
			"examplesOpen" in parsed
				? typeof parsed.examplesOpen === "boolean"
					? parsed.examplesOpen
					: null
				: false
		const importsOpen =
			"importsOpen" in parsed
				? typeof parsed.importsOpen === "boolean"
					? parsed.importsOpen
					: null
				: false
		if (examplesOpen === null || importsOpen === null) return null
		if (examplesOpen && importsOpen) return null
		if (parsed.detailsCollapsed && parsed.explorerCollapsed && examplesOpen && importsOpen) {
			return null
		}
		if ((examplesOpen || importsOpen) && (!parsed.detailsCollapsed || !parsed.explorerCollapsed)) {
			return null
		}
		return {
			detailsCollapsed: parsed.detailsCollapsed,
			explorerCollapsed: parsed.explorerCollapsed,
			examplesOpen,
			importsOpen,
		}
	} catch {
		return null
	}
}

export const writePanelState = (state: PanelState) => {
	if (typeof window === "undefined") return
	if (state.examplesOpen && state.importsOpen) return
	if (
		state.detailsCollapsed &&
		state.explorerCollapsed &&
		state.examplesOpen &&
		state.importsOpen
	) {
		return
	}
	if (
		(state.examplesOpen || state.importsOpen) &&
		(!state.detailsCollapsed || !state.explorerCollapsed)
	) {
		return
	}
	try {
		window.localStorage.setItem(PANEL_STATE_KEY, JSON.stringify(state))
	} catch {
		// Ignore storage failures (private mode, quota exceeded, etc.)
	}
}
