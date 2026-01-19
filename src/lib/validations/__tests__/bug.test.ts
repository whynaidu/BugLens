import { describe, it, expect } from "vitest";
import {
  bugStatusSchema,
  bugSeveritySchema,
  bugPrioritySchema,
  createBugSchema,
  updateBugSchema,
  isValidStatusTransition,
} from "../bug";

describe("Bug Validation Schemas", () => {
  describe("bugStatusSchema", () => {
    it("should accept valid statuses", () => {
      expect(() => bugStatusSchema.parse("OPEN")).not.toThrow();
      expect(() => bugStatusSchema.parse("IN_PROGRESS")).not.toThrow();
      expect(() => bugStatusSchema.parse("IN_REVIEW")).not.toThrow();
      expect(() => bugStatusSchema.parse("RESOLVED")).not.toThrow();
      expect(() => bugStatusSchema.parse("CLOSED")).not.toThrow();
      expect(() => bugStatusSchema.parse("REOPENED")).not.toThrow();
      expect(() => bugStatusSchema.parse("WONT_FIX")).not.toThrow();
    });

    it("should reject invalid statuses", () => {
      expect(() => bugStatusSchema.parse("INVALID")).toThrow();
      expect(() => bugStatusSchema.parse("open")).toThrow(); // lowercase
      expect(() => bugStatusSchema.parse("")).toThrow();
    });
  });

  describe("bugSeveritySchema", () => {
    it("should accept valid severities", () => {
      expect(() => bugSeveritySchema.parse("LOW")).not.toThrow();
      expect(() => bugSeveritySchema.parse("MEDIUM")).not.toThrow();
      expect(() => bugSeveritySchema.parse("HIGH")).not.toThrow();
      expect(() => bugSeveritySchema.parse("CRITICAL")).not.toThrow();
    });

    it("should reject invalid severities", () => {
      expect(() => bugSeveritySchema.parse("URGENT")).toThrow();
      expect(() => bugSeveritySchema.parse("low")).toThrow();
    });
  });

  describe("bugPrioritySchema", () => {
    it("should accept valid priorities", () => {
      expect(() => bugPrioritySchema.parse("LOW")).not.toThrow();
      expect(() => bugPrioritySchema.parse("MEDIUM")).not.toThrow();
      expect(() => bugPrioritySchema.parse("HIGH")).not.toThrow();
      expect(() => bugPrioritySchema.parse("URGENT")).not.toThrow();
    });

    it("should reject invalid priorities", () => {
      expect(() => bugPrioritySchema.parse("CRITICAL")).toThrow();
      expect(() => bugPrioritySchema.parse("")).toThrow();
    });
  });

  describe("createBugSchema", () => {
    const validBug = {
      projectId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      title: "Test Bug",
      description: "This is a test bug description",
    };

    it("should accept valid bug data", () => {
      const result = createBugSchema.safeParse(validBug);
      expect(result.success).toBe(true);
    });

    it("should set default values", () => {
      const result = createBugSchema.parse(validBug);
      expect(result.severity).toBe("MEDIUM");
      expect(result.priority).toBe("MEDIUM");
      expect(result.description).toBe("This is a test bug description");
    });

    it("should reject missing title", () => {
      const result = createBugSchema.safeParse({
        ...validBug,
        title: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject title over 200 characters", () => {
      const result = createBugSchema.safeParse({
        ...validBug,
        title: "a".repeat(201),
      });
      expect(result.success).toBe(false);
    });

    it("should accept optional assigneeId", () => {
      const result = createBugSchema.safeParse({
        ...validBug,
        assigneeId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      });
      expect(result.success).toBe(true);
    });

    it("should accept null assigneeId", () => {
      const result = createBugSchema.safeParse({
        ...validBug,
        assigneeId: null,
      });
      expect(result.success).toBe(true);
    });

    it("should validate URL format", () => {
      const validResult = createBugSchema.safeParse({
        ...validBug,
        url: "https://example.com/page",
      });
      expect(validResult.success).toBe(true);

      const invalidResult = createBugSchema.safeParse({
        ...validBug,
        url: "not-a-url",
      });
      expect(invalidResult.success).toBe(false);
    });

    it("should accept browser info", () => {
      const result = createBugSchema.safeParse({
        ...validBug,
        browserInfo: {
          name: "Chrome",
          version: "120.0",
          os: "macOS",
        },
      });
      expect(result.success).toBe(true);
    });

    it("should accept screen size", () => {
      const result = createBugSchema.safeParse({
        ...validBug,
        screenSize: {
          width: 1920,
          height: 1080,
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("updateBugSchema", () => {
    const validUpdate = {
      bugId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      title: "Updated Title",
    };

    it("should accept valid update data", () => {
      const result = updateBugSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });

    it("should require bugId", () => {
      const result = updateBugSchema.safeParse({
        title: "Updated Title",
      });
      expect(result.success).toBe(false);
    });

    it("should allow partial updates", () => {
      const result = updateBugSchema.safeParse({
        bugId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
        severity: "HIGH",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("isValidStatusTransition", () => {
    it("should allow valid transitions from OPEN", () => {
      expect(isValidStatusTransition("OPEN", "IN_PROGRESS")).toBe(true);
      expect(isValidStatusTransition("OPEN", "CLOSED")).toBe(true);
    });

    it("should reject invalid transitions from OPEN", () => {
      expect(isValidStatusTransition("OPEN", "RESOLVED")).toBe(false);
      expect(isValidStatusTransition("OPEN", "IN_REVIEW")).toBe(false);
    });

    it("should allow valid transitions from IN_PROGRESS", () => {
      expect(isValidStatusTransition("IN_PROGRESS", "OPEN")).toBe(true);
      expect(isValidStatusTransition("IN_PROGRESS", "IN_REVIEW")).toBe(true);
      expect(isValidStatusTransition("IN_PROGRESS", "RESOLVED")).toBe(true);
    });

    it("should allow valid transitions from RESOLVED", () => {
      expect(isValidStatusTransition("RESOLVED", "CLOSED")).toBe(true);
      expect(isValidStatusTransition("RESOLVED", "REOPENED")).toBe(true);
    });

    it("should reject invalid transitions from RESOLVED", () => {
      expect(isValidStatusTransition("RESOLVED", "OPEN")).toBe(false);
      expect(isValidStatusTransition("RESOLVED", "IN_PROGRESS")).toBe(false);
    });

    it("should allow reopening closed bugs", () => {
      expect(isValidStatusTransition("CLOSED", "REOPENED")).toBe(true);
    });

    it("should handle unknown status gracefully", () => {
      expect(isValidStatusTransition("UNKNOWN", "OPEN")).toBe(false);
    });
  });
});
