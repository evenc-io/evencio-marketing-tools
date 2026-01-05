import { DEFAULT_PREVIEW_DIMENSIONS, serializeSnippetFiles } from "@/lib/snippets"

export type ImportAssetKind = "svg"

export type ImportAssetId = "evencio-mark" | "evencio-lockup"

export type ImportAssetDescriptor = {
	id: ImportAssetId
	kind: ImportAssetKind
	label: string
	componentName: string
	ghost: { width: number; height: number }
	dependsOn?: ImportAssetId[]
}

export const IMPORT_ASSET_FILE_NAME = "__imports.assets.tsx"

const getImportAssetPreviewColSpan = (asset: ImportAssetDescriptor, columns: number) => {
	const safeColumns = Math.max(1, Math.floor(columns))
	if (safeColumns < 2) return 1
	const width = asset.ghost.width
	const height = asset.ghost.height
	if (!Number.isFinite(width) || width <= 0) return 1
	if (!Number.isFinite(height) || height <= 0) return 1
	const aspectRatio = width / height
	if (aspectRatio < 2.5) return 1
	return Math.min(2, safeColumns)
}

const IMPORT_ASSET_WRAPPER_CLASSNAME =
	"inline-flex h-fit w-fit shrink-0 self-start justify-self-start"

export const IMPORT_ASSETS: ImportAssetDescriptor[] = [
	{
		id: "evencio-mark",
		kind: "svg",
		label: "Evencio mark",
		componentName: "EvencioMark",
		ghost: { width: 80, height: 80 },
	},
	{
		id: "evencio-lockup",
		kind: "svg",
		label: "Evencio lockup",
		componentName: "EvencioLockup",
		ghost: { width: 220, height: 32 },
		dependsOn: ["evencio-mark"],
	},
]

export const getImportAsset = (id: ImportAssetId): ImportAssetDescriptor | null =>
	IMPORT_ASSETS.find((asset) => asset.id === id) ?? null

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const hasImportAssetComponentDeclaration = (source: string, componentName: string) => {
	const safe = componentName.trim()
	if (!safe) return false
	const name = escapeRegExp(safe)
	return new RegExp(`\\bconst\\s+${name}\\b|\\bfunction\\s+${name}\\b|\\bclass\\s+${name}\\b`).test(
		source,
	)
}

export const getImportAssetIdsInFileSource = (importsFileSource: string): ImportAssetId[] => {
	const safeSource = typeof importsFileSource === "string" ? importsFileSource : ""
	if (!safeSource.trim()) return []
	return IMPORT_ASSETS.filter((asset) =>
		hasImportAssetComponentDeclaration(safeSource, asset.componentName),
	).map((asset) => asset.id)
}

export const getImportAssetsInFileSource = (importsFileSource: string): ImportAssetDescriptor[] => {
	const ids = new Set(getImportAssetIdsInFileSource(importsFileSource))
	if (ids.size === 0) return []
	return IMPORT_ASSETS.filter((asset) => ids.has(asset.id))
}

const resolveImportAssetDependencies = (ids: ImportAssetId[]) => {
	const resolved: ImportAssetId[] = []
	const visited = new Set<ImportAssetId>()
	const visit = (id: ImportAssetId) => {
		if (visited.has(id)) return
		visited.add(id)
		const asset = getImportAsset(id)
		const deps = asset?.dependsOn ?? []
		for (const dep of deps) {
			visit(dep)
		}
		resolved.push(id)
	}
	for (const id of ids) {
		visit(id)
	}
	return resolved
}

export const getImportAssetRemovalIds = (id: ImportAssetId): ImportAssetId[] => {
	const dependentsById = new Map<ImportAssetId, ImportAssetId[]>()
	for (const asset of IMPORT_ASSETS) {
		for (const dependency of asset.dependsOn ?? []) {
			const existing = dependentsById.get(dependency) ?? []
			if (!existing.includes(asset.id)) {
				dependentsById.set(dependency, [...existing, asset.id])
			}
		}
	}

	const queue: ImportAssetId[] = [id]
	const removal = new Set<ImportAssetId>()
	while (queue.length) {
		const next = queue.pop()
		if (!next) break
		if (removal.has(next)) continue
		removal.add(next)
		for (const dependent of dependentsById.get(next) ?? []) {
			queue.push(dependent)
		}
	}

	return IMPORT_ASSETS.map((asset) => asset.id).filter((assetId) => removal.has(assetId))
}

export const buildImportAssetWrapperJsx = (asset: ImportAssetDescriptor) => {
	const dataAttr = `data-snippet-asset="${asset.id}"`
	return `<div className="${IMPORT_ASSET_WRAPPER_CLASSNAME}" ${dataAttr}><${asset.componentName} /></div>`
}

const IMPORT_ASSET_FILE_PREAMBLE = `
type EvencioAssetProps = {
  className?: string
  style?: any
}

const mergeClassName = (base: string, extra?: string) =>
  extra ? base + " " + extra : base
`.trim()

const IMPORT_ASSET_IMPLEMENTATIONS = {
	"evencio-mark": `
type EvencioMarkProps = EvencioAssetProps & { size?: number }

const EvencioMark = ({ className, style, size = 80 }: EvencioMarkProps) => (
  <svg
    data-snippet-inspect="ignore"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    aria-hidden="true"
    className={mergeClassName("shrink-0 self-center", className)}
    style={style}
  >
    <path d="M15 10H85V35H40V65H85V90H15V10Z" className="fill-neutral-950" />
    <rect x="65" y="40" width="20" height="20" fill="#0044FF" />
  </svg>
)
`.trim(),

	"evencio-lockup": `
type EvencioLockupProps = EvencioAssetProps & { markSize?: number }

const EvencioLockup = ({ className, style, markSize = 32 }: EvencioLockupProps) => (
  <span
    data-snippet-inspect="ignore"
    className={mergeClassName("inline-flex items-center gap-2 leading-none", className)}
    style={style}
  >
    <EvencioMark size={markSize} style={{ width: markSize, height: markSize }} />
    <span className="font-unbounded text-[24px] font-normal tracking-[-0.02em] uppercase leading-none whitespace-nowrap text-neutral-950">
      EVENCIO
    </span>
  </span>
)
`.trim(),
} satisfies Record<ImportAssetId, string>

export const buildImportAssetsFileSource = (assetIds?: ImportAssetId[]) => {
	const baseIds = assetIds?.length ? assetIds : IMPORT_ASSETS.map((asset) => asset.id)
	const resolvedIds = resolveImportAssetDependencies(baseIds)
	const uniqueIds = Array.from(new Set(resolvedIds))
	const blocks = uniqueIds.map((id) => IMPORT_ASSET_IMPLEMENTATIONS[id]).filter(Boolean)
	const parts = [IMPORT_ASSET_FILE_PREAMBLE, ...blocks].filter(Boolean)
	return parts.join("\n\n").trim()
}

export const ensureImportAssetsFileSource = (
	currentFileSource: string,
	assetIdsToEnsure: ImportAssetId[],
	options?: {
		resolveDependencies?: boolean
	},
) => {
	const safeCurrent = typeof currentFileSource === "string" ? currentFileSource : ""
	if (!assetIdsToEnsure.length) return safeCurrent
	const required =
		options?.resolveDependencies === false
			? assetIdsToEnsure
			: resolveImportAssetDependencies(assetIdsToEnsure)
	const uniqueRequired = Array.from(new Set(required))
	if (!safeCurrent.trim()) {
		const blocks = uniqueRequired
			.map((id) => IMPORT_ASSET_IMPLEMENTATIONS[id])
			.filter((snippet) => Boolean(snippet?.trim()))
		const parts = [IMPORT_ASSET_FILE_PREAMBLE, ...blocks].filter(Boolean)
		return parts.join("\n\n").trim()
	}

	const present = new Set(getImportAssetIdsInFileSource(safeCurrent))
	const missing = uniqueRequired.filter((id) => !present.has(id))
	if (missing.length === 0) return safeCurrent

	let next = safeCurrent.trimEnd()
	if (!/\btype\s+EvencioAssetProps\b/.test(next) || !/\bmergeClassName\b/.test(next)) {
		next = `${IMPORT_ASSET_FILE_PREAMBLE}\n\n${next.trimStart()}`
	}

	for (const id of missing) {
		const snippet = IMPORT_ASSET_IMPLEMENTATIONS[id]
		if (!snippet?.trim()) continue
		next = `${next.trimEnd()}\n\n${snippet}`
	}

	return next.trimEnd()
}

export const buildImportAssetsPreviewSource = (importsFileSource: string) => {
	const activeAssets = getImportAssetsInFileSource(importsFileSource)
	const items = activeAssets
		.map((asset) => {
			const id = JSON.stringify(asset.id)
			const label = JSON.stringify(asset.label)
			const kind = JSON.stringify(asset.kind)
			const componentName = JSON.stringify(asset.componentName)
			const width = asset.ghost.width
			const height = asset.ghost.height
			const colSpan = getImportAssetPreviewColSpan(asset, 3)
			return `  { id: ${id}, label: ${label}, kind: ${kind}, componentName: ${componentName}, width: ${width}, height: ${height}, colSpan: ${colSpan}, Component: ${asset.componentName} },`
		})
		.join("\n")

	const mainSource = `
// @import ${IMPORT_ASSET_FILE_NAME}

const ITEMS = [
${items}
] as const

export default function ImportsAssetsPreview() {
  return (
    <div data-snippet-imports-preview className="min-h-full w-full bg-neutral-50 p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
            Imports
          </div>
          <div className="text-sm font-semibold text-neutral-900">Assets</div>
        </div>
        <div className="text-[10px] text-neutral-400">{ITEMS.length} items</div>
      </div>

      {ITEMS.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-200 bg-white px-6 py-10 text-center">
          <div className="text-sm font-semibold text-neutral-900">No import assets yet</div>
          <div className="mt-1 text-xs text-neutral-500">Drag one from the Imports panel into the preview.</div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6 grid-flow-dense">
          {ITEMS.map((item) => {
            const maxWidth = item.colSpan === 2 ? 744 : 360
            const maxHeight = 240
            const safeWidth = Number.isFinite(item.width) && item.width > 0 ? item.width : maxWidth
            const safeHeight = Number.isFinite(item.height) && item.height > 0 ? item.height : maxHeight
            const colSpanClass = item.colSpan === 2 ? "col-span-2" : "col-span-1"
            return (
              <div
                key={item.id}
                data-snippet-imports-tile
                data-snippet-imports-design-width={safeWidth}
                data-snippet-imports-design-height={safeHeight}
                className={colSpanClass + " rounded-md border border-neutral-200 bg-white p-4"}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-[11px] font-semibold text-neutral-900" title={item.label}>
                    {item.label}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] uppercase tracking-widest text-neutral-400">{item.kind}</div>
                    <button
                      type="button"
                      data-snippet-imports-remove={item.id}
                      className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-500 transition-colors hover:bg-neutral-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex h-[260px] items-center justify-center rounded-md border border-dashed border-neutral-200 bg-neutral-50 p-4">
                  <div data-snippet-imports-viewport className="relative flex h-full w-full items-center justify-center overflow-hidden">
                    <div data-snippet-imports-frame className="relative shrink-0">
                      <div data-snippet-imports-content className="inline-flex shrink-0 items-start justify-start">
                        <item.Component />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-[10px] text-neutral-400">
                  <span>
                    {safeWidth}×{safeHeight}
                  </span>
                  <span className="font-mono text-neutral-500">&lt;{item.componentName} /&gt;</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
`.trim()

	return serializeSnippetFiles(mainSource, { [IMPORT_ASSET_FILE_NAME]: importsFileSource })
}

export const getImportAssetsPreviewDimensions = (columns = 3) => {
	const safeColumns = Math.max(1, Math.floor(columns))
	let rows = 0
	let usedColumns = 0
	for (const asset of IMPORT_ASSETS) {
		const span = getImportAssetPreviewColSpan(asset, safeColumns)
		if (usedColumns === 0) {
			rows += 1
		}
		if (usedColumns + span > safeColumns) {
			rows += 1
			usedColumns = 0
		}
		usedColumns += span
		if (usedColumns >= safeColumns) usedColumns = 0
	}

	// Matches the card layout in buildImportAssetsPreviewSource().
	const outerPadding = 48 // p-6 top+bottom
	const headerBlock = 72 // title + spacing
	const rowHeight = 320
	const gap = 24 // gap-6

	const rawHeight = outerPadding + headerBlock + rows * rowHeight + Math.max(0, rows - 1) * gap

	return {
		width: DEFAULT_PREVIEW_DIMENSIONS.width,
		height: Math.max(DEFAULT_PREVIEW_DIMENSIONS.height, Math.round(rawHeight)),
	} satisfies { width: number; height: number }
}
