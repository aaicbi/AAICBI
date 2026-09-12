from playwright.sync_api import sync_playwright

def run_verification(page):
    # Navigate to public course marketplace
    page.goto("http://localhost:3000/courses")
    page.wait_for_timeout(1000)
    page.screenshot(path="/home/jules/verification/screenshots/marketplace.png")

    # Click on first course
    first_course_link = page.locator("a[href^='/courses/']").first
    if first_course_link.is_visible():
        first_course_link.click()
        page.wait_for_timeout(1000)
        page.screenshot(path="/home/jules/verification/screenshots/course_details.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_verification(page)
        finally:
            context.close()
            browser.close()
