import { test, expect } from "@playwright/test";

test.describe("Projects", () => {
  test("should display projects page for authenticated users", async ({ page }) => {
    test.skip(true, "Requires authentication setup");

    await page.goto("/test-org/projects");

    await expect(page.getByRole("heading", { name: /projects/i })).toBeVisible();
  });

  test("should open create project dialog", async ({ page }) => {
    test.skip(true, "Requires authentication setup");

    await page.goto("/test-org/projects");

    await page.getByRole("button", { name: /new project|create project/i }).click();

    // Dialog should be visible
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByLabel(/project name/i)).toBeVisible();
  });

  test("should validate project name", async ({ page }) => {
    test.skip(true, "Requires authentication setup");

    await page.goto("/test-org/projects");

    await page.getByRole("button", { name: /new project|create project/i }).click();

    // Submit without filling name
    await page.getByRole("button", { name: /create/i }).click();

    // Should show validation error
    await expect(page.getByText(/required|name is required/i)).toBeVisible();
  });

  test("should navigate to project details", async ({ page }) => {
    test.skip(true, "Requires authentication setup");

    await page.goto("/test-org/projects");

    // Click on first project card
    await page.getByRole("article").first().click();

    // Should navigate to project page
    await expect(page).toHaveURL(/projects\/[\w-]+$/);
  });
});
