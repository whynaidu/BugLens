import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("should display login page", async ({ page }) => {
    await page.goto("/login");

    // Check page title or heading
    await expect(page).toHaveTitle(/BugLens|Login/i);

    // Check for login form elements
    await expect(page.getByRole("heading", { name: /sign in|login/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in|login/i })).toBeVisible();
  });

  test("should display signup page", async ({ page }) => {
    await page.goto("/signup");

    // Check for signup form elements
    await expect(page.getByRole("heading", { name: /sign up|create account/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign up|create/i })).toBeVisible();
  });

  test("should show validation errors for invalid email", async ({ page }) => {
    await page.goto("/login");

    // Fill invalid email
    await page.getByLabel(/email/i).fill("invalid-email");
    await page.getByLabel(/password/i).fill("password123");
    await page.getByRole("button", { name: /sign in|login/i }).click();

    // Should show error message
    await expect(page.getByText(/invalid email|valid email/i)).toBeVisible();
  });

  test("should navigate between login and signup", async ({ page }) => {
    await page.goto("/login");

    // Click link to signup
    await page.getByRole("link", { name: /sign up|create account/i }).click();
    await expect(page).toHaveURL(/signup/);

    // Click link back to login
    await page.getByRole("link", { name: /sign in|login/i }).click();
    await expect(page).toHaveURL(/login/);
  });

  test("should redirect unauthenticated users from dashboard", async ({ page }) => {
    await page.goto("/dashboard");

    // Should redirect to login
    await expect(page).toHaveURL(/login/);
  });
});
