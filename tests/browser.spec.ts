import { test, expect } from "@playwright/test";
test("demo dashboard, pipeline filters, export and missing configuration", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:3000");
  await expect(
    page.getByRole("heading", { name: "A clearer picture of your income." }),
  ).toBeVisible();
  await page.screenshot({ path: "docs/dashboard.png", fullPage: true });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("incomelens-cleaned.json");
  await page
    .getByRole("button", { name: "Data pipeline", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "An explainable pipeline" }),
  ).toBeVisible();
  await page.getByLabel("Classification").selectOption("review");
  await expect(page.locator("tbody tr")).not.toHaveCount(0);
  await expect(page.locator("tbody tr").first()).toContainText(
    "Unrecognized credit",
  );
  await page.screenshot({ path: "docs/pipeline.png", fullPage: true });
  await page.getByRole("button", { name: "Transactions", exact: true }).click();
  await page.getByLabel("Search transactions").fill("no-matching-entry");
  await expect(page.getByText("No matching transactions.")).toBeVisible();
  await page
    .getByRole("button", { name: "Connect Sandbox", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "needs server environment variables",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.screenshot({ path: "docs/mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
