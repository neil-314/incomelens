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
