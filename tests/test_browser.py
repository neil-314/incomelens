"""Browser test: first start the local server on port 8000."""

import os

from playwright.sync_api import expect, sync_playwright


def test_browser():
    base = os.getenv("APP_URL", "http://127.0.0.1:8000")
    with sync_playwright() as play:
        browser = play.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(base)
        expect(
            page.get_by_role("heading", name="IncomeLens", exact=True)
        ).to_be_visible()
        expect(page.locator("svg rect")).to_have_count(14)
        page.screenshot(path="docs/dashboard.png", full_page=True)
        with page.expect_download() as download:
            page.get_by_role("link", name="Export JSON").click()
        assert download.value.suggested_filename == "incomelens-cleaned.json"
        page.get_by_role("link", name="Data pipeline", exact=True).click()
        page.get_by_label("Classification").select_option("review")
        page.get_by_role("button", name="Apply", exact=True).click()
        expect(page.locator("tbody tr").first).to_contain_text("Unrecognized credit")
        page.screenshot(path="docs/pipeline.png", full_page=True)
        page.get_by_role("link", name="Transactions", exact=True).click()
        page.get_by_label("Search transactions").fill("no-matching-entry")
        page.get_by_role("button", name="Apply", exact=True).click()
