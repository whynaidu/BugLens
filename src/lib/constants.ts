// File upload constants
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_FILE_SIZE_MB = 10;

export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"] as const;

// Image processing dimensions
export const THUMBNAIL_SIZE = {
  width: 150,
  height: 150,
} as const;

export const PREVIEW_SIZE = {
  width: 600,
  height: 400,
} as const;

// Presigned URL expiration (in seconds)
export const PRESIGNED_URL_EXPIRY = 3600; // 1 hour

// Pagination defaults
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Bug status colors
export const BUG_STATUS_COLORS = {
  OPEN: "#ef4444", // red-500
  IN_PROGRESS: "#f59e0b", // amber-500
  IN_REVIEW: "#3b82f6", // blue-500
  RESOLVED: "#22c55e", // green-500
  CLOSED: "#6b7280", // gray-500
  REOPENED: "#f97316", // orange-500
} as const;

// Bug severity colors
export const BUG_SEVERITY_COLORS = {
  CRITICAL: "#dc2626", // red-600
  HIGH: "#ef4444", // red-500
  MEDIUM: "#f59e0b", // amber-500
  LOW: "#22c55e", // green-500
} as const;

// Annotation colors
export const ANNOTATION_COLORS = [
  "#EF4444", // Red (default)
  "#F97316", // Orange
  "#F59E0B", // Amber
  "#22C55E", // Green
  "#3B82F6", // Blue
  "#8B5CF6", // Violet
  "#EC4899", // Pink
] as const;

export const DEFAULT_ANNOTATION_COLOR = "#EF4444";
export const DEFAULT_STROKE_WIDTH = 2;

// Member roles
export const MEMBER_ROLES = [
  "ADMIN",
  "PROJECT_MANAGER",
  "DEVELOPER",
  "TESTER",
] as const;

export type MemberRole = (typeof MEMBER_ROLES)[number];

// Organization limits
export const ORG_LIMITS = {
  FREE: {
    maxProjects: 3,
    maxMembersPerOrg: 5,
    maxStorageGB: 1,
  },
  PRO: {
    maxProjects: 50,
    maxMembersPerOrg: 50,
    maxStorageGB: 50,
  },
  ENTERPRISE: {
    maxProjects: -1, // unlimited
    maxMembersPerOrg: -1, // unlimited
    maxStorageGB: -1, // unlimited
  },
} as const;
