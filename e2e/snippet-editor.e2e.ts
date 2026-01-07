import { expect, type Page, test } from "playwright/test"

const IMPORT_SNIPPET = `// @res 1080x1920
export default function InstagramStoryEvencio(props: {
  headline?: string
  kicker?: string
  detailsLeft?: string
  detailsRight?: string
  cta?: string
}) {
  const headline = props.headline ?? "Ship events\\nthat feel premium."
  const kicker = props.kicker ?? "EVENCIO STUDIO"
  const detailsLeft = props.detailsLeft ?? "Thu · 18:30"
  const detailsRight = props.detailsRight ?? "Berlin · Mitte"
  const cta = props.cta ?? "Get early access"

  return (
    <div className="h-full w-full bg-neutral-50 text-neutral-950">
      <div className="relative h-full w-full overflow-hidden">
        {/* Decorative geometry (big + bold for mobile) */}
        <div className="absolute left-[-140px] top-[-220px] h-[520px] w-[520px] rounded-full border border-neutral-200 bg-white" />
        <div className="absolute right-[-180px] top-[180px] h-[640px] w-[640px] rounded-full border border-neutral-200 bg-white" />
        <div className="absolute bottom-[-260px] left-[120px] h-[740px] w-[740px] rounded-full border border-neutral-200 bg-white" />

        {/* Accent blocks */}
        <div className="absolute left-[84px] top-[340px] h-[18px] w-[18px] bg-[#0044FF]" />
        <div className="absolute right-[96px] top-[520px] h-[18px] w-[18px] bg-[#0044FF]" />
        <div className="absolute left-[96px] bottom-[360px] h-[18px] w-[18px] bg-[#0044FF]" />

        {/* Frame */}
        <div className="absolute inset-[56px] rounded-[34px] border border-neutral-200 bg-white/70" />

        {/* Content */}
        <div className="relative h-full w-full px-[84px] py-[92px]">
          {/* Top bar */}
          <div className="flex items-start justify-between">
            <div
              className="inline-flex h-fit w-fit shrink-0 self-start justify-self-start"
              data-snippet-asset="evencio-lockup"
            >
              <EvencioLockup />
            </div>

            <div className="flex items-center gap-10">
              <div className="flex items-center gap-3">
                <div className="h-[12px] w-[12px] bg-[#0044FF]" />
                <div className="text-[26px] font-medium tracking-[0.22em] text-neutral-600">{kicker}</div>
              </div>
            </div>
          </div>

          {/* Main block */}
          <div className="mt-[140px] max-w-[860px]">
            <div className="inline-flex items-center gap-4 rounded-full border border-neutral-200 bg-white px-7 py-4">
              <div className="h-[14px] w-[14px] bg-[#0044FF]" />
              <div className="text-[28px] font-semibold tracking-[0.18em] text-neutral-700">NEW DROP</div>
            </div>

            <div className="mt-12 text-[96px] font-semibold leading-[0.92] tracking-[-0.03em] whitespace-pre-line">
              {headline}
            </div>

            <div className="mt-10 max-w-[780px] text-[34px] leading-[1.25] text-neutral-700">
              Build clean, branded stories for your next launch—designed to be readable at a glance.
            </div>
          </div>

          {/* Details + CTA */}
          <div className="absolute bottom-[110px] left-[84px] right-[84px]">
            <div className="flex items-end justify-between gap-10">
              <div className="flex items-center gap-10">
                <div className="rounded-[22px] border border-neutral-200 bg-white px-8 py-6">
                  <div className="text-[20px] font-semibold tracking-[0.22em] text-neutral-500">WHEN</div>
                  <div className="mt-2 text-[36px] font-semibold tracking-[-0.02em]">{detailsLeft}</div>
                </div>

                <div className="rounded-[22px] border border-neutral-200 bg-white px-8 py-6">
                  <div className="text-[20px] font-semibold tracking-[0.22em] text-neutral-500">WHERE</div>
                  <div className="mt-2 text-[36px] font-semibold tracking-[-0.02em]">{detailsRight}</div>
                </div>
              </div>

              <div className="shrink-0">
                <div className="inline-flex items-center gap-4 rounded-full bg-neutral-950 px-10 py-7">
                  <div className="h-[14px] w-[14px] bg-[#0044FF]" />
                  <div className="text-[34px] font-semibold tracking-[-0.02em] text-white">{cta}</div>
                </div>

                <div className="mt-5 text-right text-[22px] font-medium tracking-[0.14em] text-neutral-600">
                  evencio.com
                </div>
              </div>
            </div>

            {/* Bottom hairline */}
            <div className="mt-10 h-px w-full bg-neutral-200" />
          </div>
        </div>
      </div>
    </div>
  )
}

// @snippet-file __imports.assets.tsx
const EvencioMark = ({ size = 96 }: { size?: number }) => (
  <svg
    data-snippet-inspect="ignore"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    aria-hidden="true"
    className="shrink-0 self-center"
  >
    <path d="M15 10H85V35H40V65H85V90H15V10Z" className="fill-neutral-950" />
    <rect x="65" y="40" width="20" height="20" fill="#0044FF" />
  </svg>
)

const EvencioLockup = ({ markSize = 44 }: { markSize?: number }) => (
  <span data-snippet-inspect="ignore" className="inline-flex items-center gap-3 leading-none">
    <EvencioMark size={markSize} />
    <span className="font-unbounded text-[34px] font-normal tracking-[-0.02em] uppercase leading-none whitespace-nowrap text-neutral-950">
      EVENCIO
    </span>
  </span>
)
// @snippet-file-end`

const LAYOUT_SNIPPET = `// @res 520x340
export default function LayoutTest() {
  return (
    <div className="relative h-full w-full bg-neutral-50">
      <div
        data-testid="layout-box"
        className="absolute left-[120px] top-[72px] max-w-[28rem] w-32 h-10 bg-red-500"
      />
    </div>
  )
}
`

const MULTI_COMPONENT_LAYOUT_SNIPPET = `// @res 720x420
// @import Child.tsx

export default function MultiComponentLayoutTest({
  title = "Evencio Launch Night",
  subtitle = "Founders, operators, and designers in one room.",
}) {
  return (
    <div className="h-full w-full bg-white text-neutral-900">
      <div className="p-6">
        <div className="mt-8">
          <h1 data-testid="layout-h1" className="font-lexend text-[44px] leading-[1.05] tracking-[-0.02em] text-neutral-900">
            {title}
          </h1>
          <p className="mt-4 max-w-[28rem] text-base leading-relaxed text-neutral-600">
            {subtitle}
          </p>
        </div>

        <Child />
      </div>
    </div>
  )
}

// @snippet-file Child.tsx
export function Child() {
  return (
    <div className="mt-4 rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
      Imported component
    </div>
  )
}
// @snippet-file-end
`

const openNewSnippetEditor = async (page: Page) => {
	await page.goto("/library")
	await page.getByRole("link", { name: "Add Snippet" }).click()
	await expect(page).toHaveURL(/\/snippets\/editor/)
	await expect(page.getByRole("button", { name: "Create snippet" })).toBeVisible()
}

const ensureExplorerOpen = async (page: Page) => {
	const editorToggle = page.locator('button[title="Editor"]')
	const editorPressed = await editorToggle.getAttribute("aria-pressed")
	if (editorPressed !== "true") {
		await editorToggle.click()
	}

	const explorerToggle = page.locator('button[title="Explorer"]')
	const explorerPressed = await explorerToggle.getAttribute("aria-pressed")
	if (explorerPressed !== "true") {
		await explorerToggle.click()
	}
}

const ensureDetailsOpen = async (page: Page) => {
	const detailsToggle = page.locator('button[title="Snippet details"]')
	const detailsPressed = await detailsToggle.getAttribute("aria-pressed")
	if (detailsPressed !== "true") {
		await detailsToggle.click()
	}
}

const ensureImportsOpen = async (page: Page) => {
	const showImports = page.getByRole("button", { name: "Show imports panel" })
	if ((await showImports.count()) > 0) {
		await showImports.click()
	}
}

const readSnippetDraftSource = async (page: Page, draftId: string) => {
	return page.evaluate(async (targetDraftId) => {
		const databaseName = "evencio-studio"
		const storeName = "snippetDrafts"

		let db: IDBDatabase | null = null
		try {
			db = await new Promise<IDBDatabase>((resolve, reject) => {
				const request = indexedDB.open(databaseName)
				request.onerror = () => reject(request.error)
				request.onsuccess = () => resolve(request.result)
			})

			if (!db) {
				return "__NO_DB__"
			}
			const dbInstance = db

			if (!dbInstance.objectStoreNames.contains(storeName)) {
				return "__NO_STORE__"
			}

			const record = await new Promise<Record<string, unknown> | null>((resolve, reject) => {
				const tx = dbInstance.transaction(storeName, "readonly")
				const store = tx.objectStore(storeName)
				const request = store.get(targetDraftId)
				request.onerror = () => reject(request.error)
				request.onsuccess = () =>
					resolve((request.result as Record<string, unknown> | null) ?? null)
			})

			const source = record && typeof record.source === "string" ? record.source : null
			if (source) return source

			const keys = await new Promise<string[]>((resolve, reject) => {
				const tx = dbInstance.transaction(storeName, "readonly")
				const store = tx.objectStore(storeName)
				const request = store.getAllKeys()
				request.onerror = () => reject(request.error)
				request.onsuccess = () => resolve(request.result.map(String))
			})

			return `__NO_RECORD__ keys=${keys.join(",")}`
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: error && typeof error === "object" && "message" in error
						? String(error.message)
						: String(error)
			return `__ERROR__:${message}`
		} finally {
			db?.close()
		}
	}, draftId)
}

const importSnippet = async (page: Page, source: string) => {
	await page.getByRole("button", { name: "Import", exact: true }).click()
	const dialog = page.getByRole("dialog", { name: "Import snippet" })
	await expect(dialog).toBeVisible()
	await dialog.getByTestId("snippet-import-dropzone").fill(source)
	await dialog.getByRole("button", { name: "Import", exact: true }).click()
	await expect(dialog).toBeHidden()
}

const expectSnippetImported = async (page: Page) => {
	await ensureExplorerOpen(page)

	const previewFrame = page.locator('iframe[data-snippet-preview="iframe"]')
	await expect(previewFrame).toBeVisible()
	await expect(previewFrame).toHaveAttribute("style", /width:\s*1080px/)
	await expect(previewFrame).toHaveAttribute("style", /height:\s*1920px/)

	const preview = page.frameLocator('iframe[data-snippet-preview="iframe"]')
	await expect(preview.getByText("Ship events", { exact: false })).toBeVisible()
	await expect(preview.getByText("Get early access", { exact: false })).toBeVisible()

	await expect(page.getByRole("button", { name: "Imports.assets.tsx" })).toBeVisible()

	await page.getByRole("button", { name: "Imports.assets.tsx" }).click()
	await expect(page.getByText("Imports · Assets")).toBeVisible()
	await expect(preview.getByText("Evencio lockup", { exact: false })).toBeVisible()
	await expect(page.getByText("Write code to see preview")).toHaveCount(0)
}

test("snippet import applies on first try after saving a snippet", async ({ page }) => {
	await openNewSnippetEditor(page)
	await ensureDetailsOpen(page)
	await page.getByPlaceholder("Hero Banner").fill("E2E snippet")
	const createButton = page.getByRole("button", { name: "Create snippet" })
	await expect(createButton).toBeEnabled()
	await createButton.click()
	await expect(page).toHaveURL(/\/library/)

	await openNewSnippetEditor(page)
	await importSnippet(page, IMPORT_SNIPPET)
	await expectSnippetImported(page)
})

test("reset new snippet clears the cached draft and restores the starter snippet", async ({
	page,
}) => {
	await openNewSnippetEditor(page)
	await importSnippet(page, IMPORT_SNIPPET)
	await expectSnippetImported(page)

	await page.getByRole("button", { name: "Switch snippet" }).click()
	const switcher = page.getByRole("dialog", { name: "Switch snippet" })
	await expect(switcher).toBeVisible()
	await expect(switcher.getByRole("button", { name: "Reset new snippet draft" })).toBeVisible()
	await switcher.getByRole("button", { name: "Reset new snippet draft" }).click()
	await expect(switcher).toBeHidden()

	await ensureExplorerOpen(page)
	await expect(page.getByRole("button", { name: "Imports.assets.tsx" })).toHaveCount(0)

	await page.reload()
	await ensureExplorerOpen(page)
	await expect(page.getByRole("button", { name: "Imports.assets.tsx" })).toHaveCount(0)

	await page.getByRole("button", { name: "Switch snippet" }).click()
	const switcherAfterReload = page.getByRole("dialog", { name: "Switch snippet" })
	await expect(switcherAfterReload).toBeVisible()
	await expect(
		switcherAfterReload.getByRole("button", { name: "Reset new snippet draft" }),
	).toHaveCount(0)
})

test("imports gallery can import + remove built-in SVGs", async ({ page }) => {
	await openNewSnippetEditor(page)
	await ensureImportsOpen(page)

	await page.getByRole("button", { name: "Gallery" }).click()

	const gallery = page.getByRole("dialog", { name: "Imports gallery" })
	await expect(gallery).toBeVisible()

	await gallery.getByRole("button", { name: /^SVGs/ }).click()

	await gallery.getByTestId("imports-gallery-import-evencio-lockup").click()
	await expect(gallery.getByTestId("imports-gallery-remove-evencio-lockup")).toBeVisible()
	await expect(gallery.getByTestId("imports-gallery-remove-evencio-mark")).toBeVisible()

	await page.keyboard.press("Escape")
	await expect(gallery).toBeHidden()

	await expect(page.getByTestId("imports-sidebar-import-asset-evencio-lockup")).toBeVisible()
	await expect(page.getByTestId("imports-sidebar-import-asset-evencio-mark")).toBeVisible()

	await page.getByTestId("imports-sidebar-import-asset-evencio-mark").click({ button: "right" })
	await page.getByRole("menuitem", { name: "Remove import" }).click()

	await expect(page.getByTestId("imports-sidebar-import-asset-evencio-mark")).toHaveCount(0)
	await expect(page.getByTestId("imports-sidebar-import-asset-evencio-lockup")).toHaveCount(0)

	await page.getByRole("button", { name: "Gallery" }).click()
	await expect(gallery).toBeVisible()
	await gallery.getByRole("button", { name: /^SVGs/ }).click()
	await expect(gallery.getByTestId("imports-gallery-import-evencio-lockup")).toBeVisible()
	await expect(gallery.getByTestId("imports-gallery-import-evencio-mark")).toBeVisible()
})

test("layout mode persists translate + size as Tailwind utilities", async ({ page }) => {
	await openNewSnippetEditor(page)
	await importSnippet(page, LAYOUT_SNIPPET)

	const previewFrame = page.locator('iframe[data-snippet-preview="iframe"]')
	await expect(previewFrame).toBeVisible()

	const preview = page.frameLocator('iframe[data-snippet-preview="iframe"]')
	const box = preview.locator('[data-testid="layout-box"]')
	await expect(box).toBeVisible()

	await page.evaluate(() => {
		const win = window as unknown as { __e2eLayoutCommits?: unknown[] }
		win.__e2eLayoutCommits = []
		window.addEventListener("message", (event) => {
			const raw = (event as MessageEvent).data
			if (!raw || typeof raw !== "object") return
			const data = raw as { type?: unknown; commit?: unknown }
			if (data.type !== "layout-commit") return
			if (!data.commit) return
			win.__e2eLayoutCommits?.push(data.commit)
		})
	})

	const componentTreePanel = page.getByRole("complementary").filter({ hasText: "Components" })
	const componentTreeBoxNode = componentTreePanel.getByRole("button", {
		name: /div \.absolute left-\[120px\] top-\[72px\]/,
	})
	const componentTreeBoxRow = componentTreeBoxNode.locator("..")

	const readLayoutDraftSource = async () =>
		(await readSnippetDraftSource(page, "snippet-draft:new")) ?? ""
	const readLayoutBoxClassName = async () => {
		const draftSource = await readLayoutDraftSource()
		const match = draftSource.match(/data-testid="layout-box"[\s\S]*?className="([^"]*)"/)
		return match?.[1] ?? ""
	}

	const layoutButton = page.getByRole("button", { name: "Layout", exact: true })
	await layoutButton.click()
	await expect(layoutButton).toHaveAttribute("aria-pressed", "true")

	const boxBounds = await box.boundingBox()
	if (!boxBounds) {
		throw new Error("Layout test element did not return a bounding box")
	}

	// Select to reveal resize handles, then resize from bottom-right corner.
	await box.click()
	await expect(componentTreeBoxRow).toHaveClass(/bg-neutral-100/)
	const resizeHandle = preview.locator('[data-snippet-resize-handle="se"]')
	await expect(resizeHandle).toBeVisible()

	const resizeHandleBounds = await resizeHandle.boundingBox()
	if (!resizeHandleBounds) {
		throw new Error("Layout resize handle did not return a bounding box")
	}

	const handleX = resizeHandleBounds.x + resizeHandleBounds.width / 2
	const handleY = resizeHandleBounds.y + resizeHandleBounds.height / 2
	await page.mouse.move(handleX, handleY)
	await page.mouse.down()
	await page.mouse.move(handleX + 60, handleY + 30, {
		steps: 10,
	})
	await page.waitForTimeout(50)
	await page.mouse.up()

	await expect
		.poll(
			async () => {
				return await page.evaluate(() => {
					const win = window as unknown as { __e2eLayoutCommits?: unknown[] }
					return win.__e2eLayoutCommits?.length ?? 0
				})
			},
			{ timeout: 15_000 },
		)
		.toBeGreaterThanOrEqual(1)
	const firstLayoutCommit = (await page.evaluate(() => {
		const win = window as unknown as { __e2eLayoutCommits?: unknown[] }
		return win.__e2eLayoutCommits?.[0] ?? null
	})) as unknown
	const firstCommitWidth =
		firstLayoutCommit && typeof firstLayoutCommit === "object"
			? (firstLayoutCommit as { width?: unknown }).width
			: null
	const firstCommitHeight =
		firstLayoutCommit && typeof firstLayoutCommit === "object"
			? (firstLayoutCommit as { height?: unknown }).height
			: null
	if (typeof firstCommitWidth !== "number" || typeof firstCommitHeight !== "number") {
		throw new Error("Expected the first layout commit to include width + height")
	}

	await expect.poll(readLayoutBoxClassName, { timeout: 15_000 }).toMatch(/\bw-\[/)
	const firstBoxClassName = await readLayoutBoxClassName()
	await expect(componentTreeBoxRow).toHaveClass(/bg-neutral-100/)

	// Resize a second time to ensure selection doesn't jump to a parent element.
	const firstBounds = await box.boundingBox()
	if (!firstBounds) {
		throw new Error("Layout test element did not return a bounding box before second resize")
	}
	const resizedHandleBoundsFirst = await resizeHandle.boundingBox()
	if (!resizedHandleBoundsFirst) {
		throw new Error("Layout resize handle did not return a bounding box after resize")
	}
	const handleXFirst = resizedHandleBoundsFirst.x + resizedHandleBoundsFirst.width / 2
	const handleYFirst = resizedHandleBoundsFirst.y + resizedHandleBoundsFirst.height / 2
	await page.mouse.move(handleXFirst, handleYFirst)
	await page.mouse.down()
	await page.mouse.move(handleXFirst - 40, handleYFirst - 20, { steps: 10 })
	await page.waitForTimeout(50)
	await page.mouse.up()
	await expect(componentTreeBoxRow).toHaveClass(/bg-neutral-100/)

	const secondBounds = await box.boundingBox()
	if (!secondBounds) {
		throw new Error("Layout test element did not return a bounding box after second resize")
	}
	const widthChanged = Math.round(secondBounds.width) !== Math.round(firstBounds.width)
	const heightChanged = Math.round(secondBounds.height) !== Math.round(firstBounds.height)
	expect(widthChanged || heightChanged).toBe(true)

	await expect
		.poll(
			async () => {
				return await page.evaluate(() => {
					const win = window as unknown as { __e2eLayoutCommits?: unknown[] }
					return win.__e2eLayoutCommits?.length ?? 0
				})
			},
			{ timeout: 15_000 },
		)
		.toBeGreaterThanOrEqual(2)

	const secondLayoutCommit = (await page.evaluate(() => {
		const win = window as unknown as { __e2eLayoutCommits?: unknown[] }
		return win.__e2eLayoutCommits?.[1] ?? null
	})) as unknown
	const secondCommitWidth =
		secondLayoutCommit && typeof secondLayoutCommit === "object"
			? (secondLayoutCommit as { width?: unknown }).width
			: null
	const secondCommitHeight =
		secondLayoutCommit && typeof secondLayoutCommit === "object"
			? (secondLayoutCommit as { height?: unknown }).height
			: null
	if (typeof secondCommitWidth !== "number" || typeof secondCommitHeight !== "number") {
		throw new Error("Expected the second layout commit to include width + height")
	}
	const commitWidthChanged = secondCommitWidth !== firstCommitWidth
	const commitHeightChanged = secondCommitHeight !== firstCommitHeight
	expect(commitWidthChanged || commitHeightChanged).toBe(true)

	await expect
		.poll(
			async () => {
				const className = await readLayoutBoxClassName()
				return className !== firstBoxClassName ? className : ""
			},
			{ timeout: 15_000 },
		)
		.toMatch(/\bw-\[/)

	// Move the element to force a translate commit.
	const resizedBounds = await box.boundingBox()
	if (!resizedBounds) {
		throw new Error("Layout test element did not return a bounding box after resize")
	}
	const centerX = resizedBounds.x + resizedBounds.width / 2
	const centerY = resizedBounds.y + resizedBounds.height / 2
	await page.mouse.move(centerX, centerY)
	await page.keyboard.down("Alt")
	await page.mouse.down()
	await page.mouse.move(centerX + 20, centerY + 20, { steps: 10 })
	await page.waitForTimeout(50)
	await page.mouse.up()
	await page.keyboard.up("Alt")

	// Preview render is suppressed right after commits; assert persistence via the draft autosave.
	await expect.poll(readLayoutDraftSource, { timeout: 15_000 }).toMatch(/translate-x-\[/)

	const moveCommit = (await page.evaluate(() => {
		const win = window as unknown as { __e2eLayoutCommits?: unknown[] }
		const commits = win.__e2eLayoutCommits ?? []
		return commits.length > 0 ? commits[commits.length - 1] : null
	})) as unknown
	const moveTranslateY =
		moveCommit &&
		typeof moveCommit === "object" &&
		"translate" in moveCommit &&
		typeof moveCommit.translate === "object" &&
		moveCommit.translate &&
		"y" in moveCommit.translate &&
		typeof moveCommit.translate.y === "number"
			? moveCommit.translate.y
			: null

	const draftSource = await readLayoutDraftSource()
	const boxClassName = await readLayoutBoxClassName()
	expect(draftSource).toContain('data-testid="layout-box"')
	expect(boxClassName).toMatch(/translate-x-\[/)
	if (typeof moveTranslateY === "number" && Math.abs(moveTranslateY) >= 0.5) {
		expect(boxClassName).toMatch(/translate-y-\[/)
	}
	expect(boxClassName).toMatch(/\bw-\[/)
	expect(boxClassName).toMatch(/\bh-\[/)
	expect(draftSource).not.toContain("max-w-[28rem]")
	expect(draftSource).not.toMatch(/\bw-32\b/)
	expect(draftSource).not.toMatch(/\bh-10\b/)

	expect(draftSource).not.toMatch(/className="relative h-full w-full bg-neutral-50[^"]*\bw-\[/)
	expect(draftSource).not.toMatch(/className="relative h-full w-full bg-neutral-50[^"]*\bh-\[/)
})

test("layout mode preserves nested element selection after resize", async ({ page }) => {
	await openNewSnippetEditor(page)
	await importSnippet(page, MULTI_COMPONENT_LAYOUT_SNIPPET)

	const previewFrame = page.locator('iframe[data-snippet-preview="iframe"]')
	await expect(previewFrame).toBeVisible()

	const preview = page.frameLocator('iframe[data-snippet-preview="iframe"]')
	const h1 = preview.locator('[data-testid="layout-h1"]')
	await expect(h1).toBeVisible()

	const readDraftSource = async () =>
		(await readSnippetDraftSource(page, "snippet-draft:new")) ?? ""

	const layoutButton = page.getByRole("button", { name: "Layout", exact: true })
	await layoutButton.click()
	await expect(layoutButton).toHaveAttribute("aria-pressed", "true")

	await h1.click()
	const resizeHandle = preview.locator('[data-snippet-resize-handle="se"]')
	await expect(resizeHandle).toBeVisible()

	const dragHandleBy = async (dx: number, dy: number) => {
		const bounds = await resizeHandle.boundingBox()
		if (!bounds) {
			throw new Error("Layout resize handle did not return a bounding box")
		}
		const startX = bounds.x + bounds.width / 2
		const startY = bounds.y + bounds.height / 2
		await page.mouse.move(startX, startY)
		await page.mouse.down()
		await page.mouse.move(startX + dx, startY + dy, { steps: 10 })
		await page.waitForTimeout(50)
		await page.mouse.up()
	}

	await dragHandleBy(80, 30)
	await expect
		.poll(readDraftSource, { timeout: 15_000 })
		.toMatch(/data-testid="layout-h1"[^>]*className="[^"]*\bw-\[/)
	await expect
		.poll(readDraftSource, { timeout: 15_000 })
		.toMatch(/data-testid="layout-h1"[^>]*className="[^"]*\bh-\[/)

	await dragHandleBy(-40, -20)
	const draftSource = await readDraftSource()
	expect(draftSource).not.toMatch(/<div className="mt-8[^"]*\bw-\[/)
	expect(draftSource).not.toMatch(/<div className="mt-8[^"]*\bh-\[/)
	expect(draftSource).toMatch(/data-testid="layout-h1"[^>]*className="[^"]*\bw-\[/)
	expect(draftSource).toMatch(/data-testid="layout-h1"[^>]*className="[^"]*\bh-\[/)
})
