import { nanoid } from "nanoid"
import { useCallback, useEffect, useRef, useState } from "react"

const isWhitespaceChar = (char: string) =>
	char === " " || char === "\n" || char === "\t" || char === "\r" || char === "\f" || char === "\v"

const areEqualIgnoringWhitespace = (left: string, right: string) => {
	let leftIndex = 0
	let rightIndex = 0
	const leftLength = left.length
	const rightLength = right.length

	while (leftIndex < leftLength || rightIndex < rightLength) {
		while (leftIndex < leftLength && isWhitespaceChar(left[leftIndex])) {
			leftIndex += 1
		}
		while (rightIndex < rightLength && isWhitespaceChar(right[rightIndex])) {
			rightIndex += 1
		}
		if (leftIndex >= leftLength || rightIndex >= rightLength) {
			break
		}
		if (left[leftIndex] !== right[rightIndex]) return false
		leftIndex += 1
		rightIndex += 1
	}

	while (leftIndex < leftLength && isWhitespaceChar(left[leftIndex])) {
		leftIndex += 1
	}
	while (rightIndex < rightLength && isWhitespaceChar(right[rightIndex])) {
		rightIndex += 1
	}

	return leftIndex >= leftLength && rightIndex >= rightLength
}

export interface SnippetHistoryEntry {
	id: string
	source: string
	label: string
	createdAt: number
}

interface SnippetHistoryState {
	entries: SnippetHistoryEntry[]
	activeIndex: number
}

interface UseSnippetHistoryOptions {
	source: string
	onApply: (source: string) => void
	maxEntries?: number
	debounceMs?: number
	minChangeChars?: number
	minCommitIntervalMs?: number
	ignoreWhitespaceOnly?: boolean
	getLabel?: () => string
	initialLabel?: string
}

export function useSnippetHistory({
	source,
	onApply,
	maxEntries = 10,
	debounceMs = 800,
	minChangeChars = 6,
	minCommitIntervalMs = 1200,
	ignoreWhitespaceOnly = true,
	getLabel,
	initialLabel = "Start",
}: UseSnippetHistoryOptions) {
	const maxEntriesSafe = Math.max(1, maxEntries)
	const minChangeCharsSafe = Math.max(0, minChangeChars)
	const minCommitIntervalMsSafe = Math.max(0, minCommitIntervalMs)
	const [history, setHistory] = useState<SnippetHistoryState>(() => ({
		entries: [
			{
				id: nanoid(),
				source,
				label: initialLabel,
				createdAt: Date.now(),
			},
		],
		activeIndex: 0,
	}))
	const historyRef = useRef(history)
	const lastSourceRef = useRef(source)
	const pendingLabelRef = useRef<string | null>(null)
	const pendingSourceRef = useRef(source)
	const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const isApplyingRef = useRef(false)

	useEffect(() => {
		historyRef.current = history
	}, [history])

	const clearPendingTimer = useCallback(() => {
		if (!pendingTimerRef.current) return
		clearTimeout(pendingTimerRef.current)
		pendingTimerRef.current = null
	}, [])

	const commitEntry = useCallback(
		(nextSource: string, label?: string, options?: { force?: boolean }) => {
			setHistory((prev) => {
				const base = prev.entries.slice(0, prev.activeIndex + 1)
				const lastEntry = base[base.length - 1]
				if (lastEntry?.source === nextSource) return prev
				const now = Date.now()
				if (!options?.force && lastEntry) {
					const whitespaceOnly =
						ignoreWhitespaceOnly && areEqualIgnoringWhitespace(nextSource, lastEntry.source)
					const changeSize = Math.abs(nextSource.length - lastEntry.source.length)
					const timeSinceCommit = now - lastEntry.createdAt
					const shouldMerge =
						whitespaceOnly ||
						(changeSize < minChangeCharsSafe && timeSinceCommit < minCommitIntervalMsSafe)
					if (shouldMerge) {
						const mergedEntry: SnippetHistoryEntry = {
							...lastEntry,
							source: nextSource,
							label: label ?? lastEntry.label,
							createdAt: now,
						}
						const nextEntries = [...base.slice(0, -1), mergedEntry]
						return {
							entries: nextEntries,
							activeIndex: Math.max(nextEntries.length - 1, 0),
						}
					}
				}
				const entryLabel = label ?? getLabel?.() ?? "Edit"
				const nextEntry: SnippetHistoryEntry = {
					id: nanoid(),
					source: nextSource,
					label: entryLabel,
					createdAt: now,
				}
				let nextEntries = [...base, nextEntry]
				let nextIndex = base.length
				if (nextEntries.length > maxEntriesSafe) {
					const overflow = nextEntries.length - maxEntriesSafe
					nextEntries = nextEntries.slice(overflow)
					nextIndex = Math.max(nextIndex - overflow, 0)
				}
				return {
					entries: nextEntries,
					activeIndex: nextIndex,
				}
			})
		},
		[getLabel, ignoreWhitespaceOnly, maxEntriesSafe, minChangeCharsSafe, minCommitIntervalMsSafe],
	)

	const markLabel = useCallback((label: string) => {
		pendingLabelRef.current = label
	}, [])

	const commitNow = useCallback(
		(label?: string, overrideSource?: string) => {
			clearPendingTimer()
			pendingLabelRef.current = null
			const nextSource = overrideSource ?? source
			lastSourceRef.current = nextSource
			pendingSourceRef.current = nextSource
			commitEntry(nextSource, label, { force: true })
		},
		[clearPendingTimer, commitEntry, source],
	)

	const reset = useCallback(
		(nextSource: string, label?: string) => {
			clearPendingTimer()
			pendingLabelRef.current = null
			lastSourceRef.current = nextSource
			pendingSourceRef.current = nextSource
			setHistory({
				entries: [
					{
						id: nanoid(),
						source: nextSource,
						label: label ?? initialLabel,
						createdAt: Date.now(),
					},
				],
				activeIndex: 0,
			})
		},
		[clearPendingTimer, initialLabel],
	)

	const applyIndex = useCallback(
		(index: number) => {
			const entry = historyRef.current.entries[index]
			if (!entry) return
			clearPendingTimer()
			pendingLabelRef.current = null
			isApplyingRef.current = true
			lastSourceRef.current = entry.source
			pendingSourceRef.current = entry.source
			onApply(entry.source)
			setHistory((prev) => (prev.activeIndex === index ? prev : { ...prev, activeIndex: index }))
		},
		[clearPendingTimer, onApply],
	)

	const undo = useCallback(() => {
		const { activeIndex } = historyRef.current
		if (activeIndex <= 0) return
		applyIndex(activeIndex - 1)
	}, [applyIndex])

	const redo = useCallback(() => {
		const { activeIndex, entries } = historyRef.current
		if (activeIndex >= entries.length - 1) return
		applyIndex(activeIndex + 1)
	}, [applyIndex])

	useEffect(() => {
		if (isApplyingRef.current) {
			isApplyingRef.current = false
			return
		}
		if (source === lastSourceRef.current) return
		lastSourceRef.current = source
		pendingSourceRef.current = source
		const nextLabel = pendingLabelRef.current ?? getLabel?.() ?? "Edit"
		pendingLabelRef.current = nextLabel
		clearPendingTimer()
		if (debounceMs <= 0) {
			pendingLabelRef.current = null
			commitEntry(source, nextLabel)
			return
		}
		pendingTimerRef.current = setTimeout(() => {
			const label = pendingLabelRef.current ?? nextLabel
			pendingLabelRef.current = null
			commitEntry(pendingSourceRef.current, label)
		}, debounceMs)
	}, [clearPendingTimer, commitEntry, debounceMs, getLabel, source])

	useEffect(() => {
		return () => clearPendingTimer()
	}, [clearPendingTimer])

	return {
		entries: history.entries,
		activeIndex: history.activeIndex,
		canUndo: history.activeIndex > 0,
		canRedo: history.activeIndex < history.entries.length - 1,
		undo,
		redo,
		jumpTo: applyIndex,
		markLabel,
		commitNow,
		reset,
	}
}
