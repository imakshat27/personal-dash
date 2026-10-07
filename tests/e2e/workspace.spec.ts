import { test, expect } from "@playwright/test";
test("calendar day navigation does not reuse today's events", async ({
  page,
}) => {
  await page.goto("/calendar");
  await expect(
    page.getByText("Design catch-up", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next day" }).click();
  await expect(
    page.getByText("Design catch-up", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(
    page.getByText("Design catch-up", { exact: true }),
  ).toBeVisible();
});
test("Google login is readable on mobile and explains a disallowed account", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login?error=account");
  await expect(
    page.getByRole("heading", { name: "Welcome to your orbit." }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "Choose your personal account",
  );
  await expect(
    page.getByRole("link", { name: "Sign in with Google" }),
  ).toHaveAttribute("href", "/api/auth/login");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Sign in with Google" }).focus();
  await expect(
    page.getByRole("link", { name: "Sign in with Google" }),
  ).toBeFocused();
});
test("existing Drive file details explain and enforce read-only access", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "orbit.demo.files",
      JSON.stringify([
        {
          id: "drive:existing",
          provider: "drive",
          providerId: "existing",
          name: "My existing file.txt",
          virtualPath: "/Drive",
          mimeType: "text/plain",
          size: 100,
          modifiedAt: "2026-10-07T00:00:00Z",
          writable: false,
        },
      ]),
    );
  });
  await page.goto("/storage");
  await page
    .getByRole("button", { name: "My existing file.txt /Drive" })
    .click();
  await expect(
    page.getByText("Orbit only edits files uploaded through Orbit.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("File name")).toHaveAttribute("readonly", "");
  await expect(page.getByLabel("Virtual folder")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Save changes" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Delete", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("File name").press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
});
test("capture, persist, edit, pin, search and delete a thought", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Quick capture" }).first().click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("A browser-tested thought");
  await page.getByLabel("Your note").fill("Keep the little things.");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Notes", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A browser-tested thought" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A browser-tested thought" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit A browser-tested thought" })
    .click();
  await page.getByLabel("Title", { exact: true }).fill("An updated thought");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  const card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "An updated thought" }) });
  await card.getByRole("button", { name: "Pin note", exact: true }).click();
  await expect(card.getByRole("button", { name: "Unpin note" })).toBeVisible();
  await page.keyboard.press("Control+k");
  await page.getByLabel("Search everything").fill("updated thought");
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("button", { name: "An updated thought Note" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete An updated thought" }).click();
  await expect(
    page.getByRole("heading", { name: "An updated thought" }),
  ).toHaveCount(0);
});
test("upload, download, rename, move and delete an actual file", async ({
  page,
}) => {
  await page.goto("/storage");
  await page.locator("input[type=file]").setInputFiles({
    name: "test.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello orbit"),
  });
  await expect(
    page.getByRole("button", { name: "test.txt /Documents" }),
  ).toBeVisible();
  const result = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download test.txt" }).click();
  expect((await result).suggestedFilename()).toBe("test.txt");
  await page.getByRole("button", { name: "test.txt /Documents" }).click();
  await page.getByLabel("File name").fill("renamed.txt");
  await page.getByLabel("Virtual folder").selectOption("/Archives");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("button", { name: "renamed.txt /Archives" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "renamed.txt /Archives" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "renamed.txt /Archives" }),
  ).toHaveCount(0);
});
test("mobile navigation, both themes and reduced motion do not overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A little more together." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "My storage" })
    .click();
  await expect(
    page.getByRole("heading", { name: "My storage." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 812, height: 375 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
