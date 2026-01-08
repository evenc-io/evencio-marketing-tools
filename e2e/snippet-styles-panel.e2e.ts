import { expect, type Page, test } from "playwright/test"

const STYLE_SNIPPET = `// @res 320x260
export default function StylesPanelE2E() {
  return (
    <div className="h-full w-full bg-white p-6">
      <div
        data-testid="style-box"
        className="e2e-style-box h-10 w-10 bg-neutral-200 border border-neutral-300 rounded-md"
      />
      <p
        data-testid="style-text"
        className="e2e-style-text mt-6 text-neutral-600 text-sm font-semibold"
      >
        Hello
      </p>
    </div>
  )
}
`

const STYLE_SEMANTIC_TOKEN_SNIPPET = `// @res 320x260
export default function StylesSemanticTokensE2E() {
  return (
    <div className="h-full w-full bg-background p-6">
      <p data-testid="style-text" className="mt-6 text-foreground text-sm font-semibold">
        Hello
      </p>
    </div>
  )
}
`

const openNewSnippetEditor = async (page: Page) => {
	await page.goto("/library")
	await page.getByRole("link", { name: "Add Snippet" }).click()
	await expect(page).toHaveURL(/\/snippets\/editor/)
	await expect(page.getByRole("button", { name: "Create snippet" })).toBeVisible()
}

const importSnippet = async (page: Page, source: string) => {
	await page.getByRole("button", { name: "Import", exact: true }).click()
	const dialog = page.getByRole("dialog", { name: "Import snippet" })
	await expect(dialog).toBeVisible()
	await dialog.getByTestId("snippet-import-dropzone").fill(source)
	await dialog.getByRole("button", { name: "Import", exact: true }).click()
	await expect(dialog).toBeHidden()
}

const ensureE2EDebugEnabled = async (page: Page) => {
	await page.evaluate(() => {
		;(
			window as unknown as { __EVENCIO_E2E_SNIPPET_STYLE_DEBUG__?: unknown }
		).__EVENCIO_E2E_SNIPPET_STYLE_DEBUG__ = { lastUpdate: null }
	})
}

const waitForStyleUpdateLabel = async (page: Page, label: string) => {
	await expect
		.poll(
			async () => {
				return await page.evaluate((expectedLabel) => {
					const win = window as unknown as {
						__EVENCIO_E2E_SNIPPET_STYLE_DEBUG__?: { lastUpdate?: unknown }
					}
					const update = win.__EVENCIO_E2E_SNIPPET_STYLE_DEBUG__?.lastUpdate
					if (!update || typeof update !== "object") return null
					const data = update as {
						phase?: unknown
						label?: unknown
						applied?: unknown
						changed?: unknown
						reason?: unknown
						error?: unknown
					}
					if (data.label !== expectedLabel) {
						return `mismatch:${String(data.label ?? "unknown")}`
					}
					if (data.phase === "response" && data.changed === false) {
						return `rejected:${String(data.reason ?? "unknown")}`
					}
					if (data.phase === "error") {
						return `error:${String(data.error ?? "unknown")}`
					}
					if (data.phase !== "applied") return `pending:${String(data.phase ?? "unknown")}`
					return data.applied === true ? "ok" : "not-applied"
				}, label)
			},
			{ timeout: 15_000 },
		)
		.toBe("ok")
}

test("styles panel updates source/preview without losing focus", async ({ page }) => {
	await openNewSnippetEditor(page)
	await importSnippet(page, STYLE_SNIPPET)

	await ensureE2EDebugEnabled(page)

	const previewFrame = page.locator('iframe[data-snippet-preview="iframe"]')
	await expect(previewFrame).toBeVisible()

	const preview = page.frameLocator('iframe[data-snippet-preview="iframe"]')
	const box = preview.locator('[data-testid="style-box"]')
	await expect(box).toBeVisible()

	const layoutButton = page.getByRole("button", { name: "Layout", exact: true })
	await layoutButton.click()
	await expect(layoutButton).toHaveAttribute("aria-pressed", "true")

	await box.click({ button: "right" })
	const menu = page.getByRole("menu", { name: "Inspect actions" })
	await expect(menu).toBeVisible()
	await menu.getByRole("menuitem", { name: "Edit styles" }).click()

	const stylesPanel = page.getByTestId("snippet-styles-panel")
	await expect(stylesPanel).toBeVisible()
	await expect(stylesPanel.getByText("<div>")).toBeVisible()

	const background = stylesPanel.getByTestId("snippet-styles-section-background")
	await expect(background.getByRole("button", { name: "Remove background" })).toBeVisible()

	await background.getByRole("tab", { name: "Custom" }).click()
	const backgroundHexInput = background.getByPlaceholder("#000000")
	await backgroundHexInput.click()
	await backgroundHexInput.fill("#ff0000")
	await expect(backgroundHexInput).toBeFocused()

	await waitForStyleUpdateLabel(page, "Update background")

	await expect
		.poll(
			async () => {
				const className = await box.getAttribute("class")
				return (
					typeof className === "string" &&
					className.includes("bg-[#ff0000]") &&
					!className.includes("bg-neutral-200")
				)
			},
			{ timeout: 30_000 },
		)
		.toBe(true)

	await expect
		.poll(
			async () => {
				return await box.evaluate((node) => {
					return getComputedStyle(node).backgroundColor
				})
			},
			{ timeout: 30_000 },
		)
		.toMatch(/255,\s*0,\s*0/)

	await expect(stylesPanel.getByText("<div>")).toBeVisible()
})

test("tailwind token picker applies palette token without overflowing the dialog", async ({
	page,
}) => {
	await openNewSnippetEditor(page)
	await importSnippet(page, STYLE_SNIPPET)
	await ensureE2EDebugEnabled(page)

	const previewFrame = page.locator('iframe[data-snippet-preview="iframe"]')
	await expect(previewFrame).toBeVisible()

	const preview = page.frameLocator('iframe[data-snippet-preview="iframe"]')
	const text = preview.locator('[data-testid="style-text"]')
	await expect(text).toBeVisible()

	const layoutButton = page.getByRole("button", { name: "Layout", exact: true })
	await layoutButton.click()
	await expect(layoutButton).toHaveAttribute("aria-pressed", "true")

	await text.click({ button: "right" })
	const menu = page.getByRole("menu", { name: "Inspect actions" })
	await expect(menu).toBeVisible()
	await menu.getByRole("menuitem", { name: "Edit styles" }).click()

	const stylesPanel = page.getByTestId("snippet-styles-panel")
	await expect(stylesPanel).toBeVisible()

	const typeSection = stylesPanel.getByTestId("snippet-styles-section-type")
	await expect(typeSection).toBeVisible()

	await typeSection.getByRole("tab", { name: "Token" }).click()
	await typeSection.getByRole("button", { name: "neutral-600" }).click()

	const dialog = page.getByRole("dialog", { name: "Text color" })
	await expect(dialog).toBeVisible()

	const viewport = page.viewportSize()
	expect(viewport).not.toBeNull()
	const bounds = await dialog.boundingBox()
	expect(bounds).not.toBeNull()
	if (viewport && bounds) {
		expect(bounds.x).toBeGreaterThanOrEqual(-1)
		expect(bounds.y).toBeGreaterThanOrEqual(-1)
		expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1)
		expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1)
	}

	await dialog.getByRole("button", { name: "emerald-500" }).click()
	await expect(dialog).toBeHidden()

	await waitForStyleUpdateLabel(page, "Update typography")

	await expect
		.poll(
			async () => {
				const className = await text.getAttribute("class")
				return (
					typeof className === "string" &&
					className.includes("text-emerald-500") &&
					!className.includes("text-neutral-600")
				)
			},
			{ timeout: 30_000 },
		)
		.toBe(true)
})

test("tailwind token picker does not offer semantic theme tokens", async ({ page }) => {
	await openNewSnippetEditor(page)
	await importSnippet(page, STYLE_SEMANTIC_TOKEN_SNIPPET)
	await ensureE2EDebugEnabled(page)

	const previewFrame = page.locator('iframe[data-snippet-preview="iframe"]')
	await expect(previewFrame).toBeVisible()

	const preview = page.frameLocator('iframe[data-snippet-preview="iframe"]')
	const text = preview.locator('[data-testid="style-text"]')
	await expect(text).toBeVisible()

	const layoutButton = page.getByRole("button", { name: "Layout", exact: true })
	await layoutButton.click()
	await expect(layoutButton).toHaveAttribute("aria-pressed", "true")

	await text.click({ button: "right" })
	const menu = page.getByRole("menu", { name: "Inspect actions" })
	await expect(menu).toBeVisible()
	await menu.getByRole("menuitem", { name: "Edit styles" }).click()

	const stylesPanel = page.getByTestId("snippet-styles-panel")
	await expect(stylesPanel).toBeVisible()

	const typeSection = stylesPanel.getByTestId("snippet-styles-section-type")
	await expect(typeSection).toBeVisible()

	await typeSection.getByRole("tab", { name: "Token" }).click()
	await typeSection.getByRole("button", { name: "foreground" }).click()

	const dialog = page.getByRole("dialog", { name: "Text color" })
	await expect(dialog).toBeVisible()

	await expect(dialog.getByRole("button", { name: "foreground" })).toHaveCount(0)

	await dialog.getByRole("button", { name: "emerald-500" }).click()
	await expect(dialog).toBeHidden()

	await waitForStyleUpdateLabel(page, "Update typography")

	await expect
		.poll(
			async () => {
				const className = await text.getAttribute("class")
				return (
					typeof className === "string" &&
					className.includes("text-emerald-500") &&
					!className.includes("text-foreground")
				)
			},
			{ timeout: 30_000 },
		)
		.toBe(true)
})

test("styles panel retargets when selecting another element", async ({ page }) => {
	await openNewSnippetEditor(page)
	await importSnippet(page, STYLE_SNIPPET)

	await page.evaluate(() => {
		const win = window as unknown as { __e2eInspectSelects?: unknown[] }
		win.__e2eInspectSelects = []
		window.addEventListener("message", (event) => {
			const raw = (event as MessageEvent).data
			if (!raw || typeof raw !== "object") return
			const data = raw as { type?: unknown; source?: unknown }
			if (data.type !== "inspect-select") return
			win.__e2eInspectSelects?.push(data.source ?? null)
		})
	})

	const previewFrame = page.locator('iframe[data-snippet-preview="iframe"]')
	await expect(previewFrame).toBeVisible()

	const preview = page.frameLocator('iframe[data-snippet-preview="iframe"]')
	const box = preview.locator('[data-testid="style-box"]')
	const text = preview.locator('[data-testid="style-text"]')
	await expect(box).toBeVisible()
	await expect(text).toBeVisible()

	const layoutButton = page.getByRole("button", { name: "Layout", exact: true })
	await layoutButton.click()
	await expect(layoutButton).toHaveAttribute("aria-pressed", "true")

	await box.click({ button: "right" })
	const menu = page.getByRole("menu", { name: "Inspect actions" })
	await expect(menu).toBeVisible()
	await menu.getByRole("menuitem", { name: "Edit styles" }).click()

	const stylesPanel = page.getByTestId("snippet-styles-panel")
	await expect(stylesPanel.getByText("<div>")).toBeVisible()
	await page.waitForTimeout(250)

	await expect
		.poll(
			async () => {
				return await page.evaluate(() => {
					const win = window as unknown as { __e2eInspectSelects?: unknown[] }
					const selects = win.__e2eInspectSelects ?? []
					return selects.length
				})
			},
			{ timeout: 15_000 },
		)
		.toBeGreaterThanOrEqual(1)

	const getLastInspectSelectLine = () =>
		page.evaluate(() => {
			const win = window as unknown as { __e2eInspectSelects?: unknown[] }
			const selects = win.__e2eInspectSelects ?? []
			const last = selects.length ? selects[selects.length - 1] : null
			if (!last || typeof last !== "object") return null
			const source = last as { lineNumber?: unknown }
			return typeof source.lineNumber === "number" ? source.lineNumber : null
		})

	const firstInspectLine = (await getLastInspectSelectLine()) as number | null
	expect(firstInspectLine).not.toBeNull()

	const componentTreePanel = page
		.getByRole("complementary")
		.filter({ has: page.getByText("Components", { exact: true }) })
	await expect(componentTreePanel).toBeVisible()
	await componentTreePanel.getByRole("button", { name: /p \.e2e-style-text/ }).click()
	await expect
		.poll(
			async () => {
				return await page.evaluate(() => {
					const win = window as unknown as { __e2eInspectSelects?: unknown[] }
					const selects = win.__e2eInspectSelects ?? []
					return selects.length
				})
			},
			{ timeout: 15_000 },
		)
		.toBeGreaterThanOrEqual(2)

	const secondInspectLine = (await getLastInspectSelectLine()) as number | null
	expect(secondInspectLine).not.toBeNull()
	expect(secondInspectLine).not.toBe(firstInspectLine)

	await expect(stylesPanel.getByText("<p>")).toBeVisible()
	await expect(stylesPanel.getByRole("button", { name: "Remove background" })).toHaveCount(0)
})

test("styles panel applies font family + padding utilities", async ({ page }) => {
	await openNewSnippetEditor(page)
	await importSnippet(page, STYLE_SNIPPET)
	await ensureE2EDebugEnabled(page)

	const previewFrame = page.locator('iframe[data-snippet-preview="iframe"]')
	await expect(previewFrame).toBeVisible()

	const preview = page.frameLocator('iframe[data-snippet-preview="iframe"]')
	const text = preview.locator('[data-testid="style-text"]')
	await expect(text).toBeVisible()

	const layoutButton = page.getByRole("button", { name: "Layout", exact: true })
	await layoutButton.click()
	await expect(layoutButton).toHaveAttribute("aria-pressed", "true")

	await text.click({ button: "right" })
	const menu = page.getByRole("menu", { name: "Inspect actions" })
	await expect(menu).toBeVisible()
	await menu.getByRole("menuitem", { name: "Edit styles" }).click()

	const stylesPanel = page.getByTestId("snippet-styles-panel")
	await expect(stylesPanel).toBeVisible()
	await expect(stylesPanel.getByText("<p>")).toBeVisible()

	const typeSection = stylesPanel.getByTestId("snippet-styles-section-type")
	await expect(typeSection).toBeVisible()

	const fontFamilySelect = typeSection.getByRole("combobox", { name: "Font family" })
	if (!(await fontFamilySelect.isVisible())) {
		await typeSection.getByRole("button", { name: "Type" }).click()
	}

	await fontFamilySelect.selectOption("mono")
	await waitForStyleUpdateLabel(page, "Update typography")

	await expect
		.poll(
			async () => {
				const className = await text.getAttribute("class")
				return (
					typeof className === "string" &&
					className.includes("font-mono") &&
					className.includes("font-semibold") &&
					className.includes("text-sm")
				)
			},
			{ timeout: 30_000 },
		)
		.toBe(true)

	const spacingSection = stylesPanel.getByTestId("snippet-styles-section-spacing")
	await expect(spacingSection).toBeVisible()
	await spacingSection.getByRole("button", { name: "Spacing" }).click()

	const paddingSelect = spacingSection.getByLabel("Padding", { exact: true })
	await paddingSelect.selectOption("4")
	await waitForStyleUpdateLabel(page, "Update spacing")

	await expect
		.poll(
			async () => {
				const className = await text.getAttribute("class")
				return typeof className === "string" && className.includes("p-4")
			},
			{ timeout: 30_000 },
		)
		.toBe(true)

	await expect
		.poll(
			async () => {
				return await text.evaluate((node) => {
					const style = getComputedStyle(node)
					return `${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`
				})
			},
			{ timeout: 30_000 },
		)
		.toBe("16px 16px 16px 16px")
})
