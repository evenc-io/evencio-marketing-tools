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
