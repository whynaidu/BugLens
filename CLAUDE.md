# BugLens - Visual Bug Tracking Platform

## Overview
BugLens is a multi-tenant visual bug tracking and annotation platform that allows testers to capture screenshots, annotate bugs visually, and collaborate with developers in real-time.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, TailwindCSS
- **UI Library**: ShadCN UI (MANDATORY - use for ALL UI components)
- **Backend**: tRPC for type-safe APIs, Prisma ORM
- **Database**: PostgreSQL with Row-Level Security
- **Real-time**: Liveblocks + Yjs for collaborative features
- **Storage**: AWS S3 + CloudFront CDN
- **Auth**: NextAuth.js v5 (Google, Microsoft, Email/Password)
- **Queue**: BullMQ + Redis for background jobs
- **Email**: Resend

## Commands
```bash
npm run dev          # Start development server (port 3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
npm run db:push      # Push Prisma schema (dev)
npm run db:migrate   # Run migrations (production)
npm run db:seed      # Seed database
npm run db:studio    # Open Prisma Studio
npm run test         # Run tests
npm run test:e2e     # Run E2E tests
```

## Project Structure
```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth pages (login, signup)
│   ├── (dashboard)/       # Protected dashboard routes
│   │   └── [orgSlug]/     # Organization-scoped routes
│   ├── (marketing)/       # Public pages
│   └── api/               # API routes
├── components/
│   ├── ui/                # ShadCN components (DO NOT MODIFY)
│   ├── annotation/        # Canvas and drawing tools
│   ├── bugs/              # Bug-related components
│   ├── projects/          # Project components
│   ├── layout/            # Layout components
│   └── shared/            # Shared/common components
├── server/
│   ├── routers/           # tRPC routers
│   ├── services/          # Business logic services
│   ├── auth.ts            # NextAuth configuration
│   ├── db.ts              # Prisma client
│   └── trpc.ts            # tRPC configuration
├── lib/
│   ├── validations/       # Zod schemas
│   ├── utils.ts           # Utility functions
│   ├── constants.ts       # App constants
│   ├── permissions.ts     # CASL abilities
│   └── liveblocks.ts      # Liveblocks config
├── hooks/                 # Custom React hooks
├── store/                 # Zustand stores
├── types/                 # TypeScript types
└── workers/               # BullMQ workers
```

## Key Files
- `prisma/schema.prisma` - Database schema
- `src/server/routers/index.ts` - Main tRPC router
- `src/lib/validations/*.ts` - Zod validation schemas
- `src/components/annotation/canvas.tsx` - Main annotation canvas
- `src/lib/liveblocks.ts` - Real-time collaboration setup

## Coding Standards

### TypeScript
- Use strict mode (`"strict": true`)
- No `any` types - use proper typing or `unknown`
- Define interfaces for all data structures
- Use Zod for runtime validation

### React Components
- Functional components with hooks only
- Server Components by default
- Add `"use client"` only when necessary (hooks, events, browser APIs)
- Colocate files: `page.tsx`, `loading.tsx`, `error.tsx`

### ShadCN UI (CRITICAL)
- Use ShadCN components for ALL UI elements
- Never create custom buttons, inputs, dialogs - use ShadCN
- Follow ShadCN patterns for forms (React Hook Form + Zod)
- Extend ShadCN components in `components/ui/` if needed

### Forms
```tsx
// Always use this pattern
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";

const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
  defaultValues: { ... }
});
```

### API Calls
- Use tRPC for all internal API calls
- Use React Query patterns via tRPC hooks
- Handle loading and error states

```tsx
// Query
const { data, isLoading, error } = trpc.bugs.getById.useQuery({ id });

// Mutation
const mutation = trpc.bugs.create.useMutation({
  onSuccess: () => {
    toast.success("Bug created");
    utils.bugs.getByProject.invalidate();
  },
  onError: (error) => {
    toast.error(error.message);
  }
});
```

### Error Handling
- Use try-catch in async functions
- Show user-friendly error messages via toast
- Log errors for debugging
- Implement error boundaries for components

### State Management
- Server state: tRPC + React Query
- UI state: Zustand (sidebar, modals)
- URL state: nuqs (filters, pagination)
- Form state: React Hook Form

## Database Patterns

### Multi-tenancy
- All queries must filter by `organizationId`
- Use middleware to validate org access
- Never expose data from other organizations

### Audit Logging
```tsx
// Always log changes to bugs
await db.auditLog.create({
  data: {
    bugId,
    userId: ctx.session.user.id,
    action: "STATUS_CHANGED",
    details: { from: oldStatus, to: newStatus }
  }
});
```

## Annotation System

### Coordinate System
- Store coordinates as normalized values (0-1)
- Scale to container dimensions when rendering
- Enables responsive display across screen sizes

```tsx
// Storing
const normalizedX = pixelX / containerWidth;  // 0-1
const normalizedY = pixelY / containerHeight; // 0-1

// Rendering
const renderX = annotation.x * containerWidth;
const renderY = annotation.y * containerHeight;
```

### Shape Colors
- Default stroke color: `#EF4444` (Red)
- Default stroke width: 2px
- Use consistent styling for all annotation types

## User Roles & Permissions
| Role | Permissions |
|------|-------------|
| ADMIN | Full access to everything |
| PROJECT_MANAGER | Manage projects, assign bugs, view reports |
| DEVELOPER | View/update assigned bugs, add comments |
| TESTER | Create bugs, upload screenshots, annotate |

## Testing Approach
- Unit tests: Services and utilities (Vitest)
- Integration tests: tRPC routers
- E2E tests: Critical user flows (Playwright)
- Test files: `*.test.ts` or `*.spec.ts`

## Common Patterns

### Protected Routes
```tsx
// In layout.tsx
import { auth } from "@/server/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }) {
  const session = await auth();
  if (!session) redirect("/login");
  return <>{children}</>;
}
```

### Organization Context
```tsx
// Get current org in server components
const org = await db.organization.findUnique({
  where: { slug: params.orgSlug }
});

// Validate membership
const member = await db.member.findUnique({
  where: { 
    userId_organizationId: {
      userId: session.user.id,
      organizationId: org.id
    }
  }
});
```

### S3 Upload Pattern
```tsx
// 1. Get presigned URL from server
const { uploadUrl, key } = await trpc.screenshots.getUploadUrl.mutate({
  fileName: file.name,
  contentType: file.type
});

// 2. Upload directly to S3
await fetch(uploadUrl, {
  method: "PUT",
  body: file,
  headers: { "Content-Type": file.type }
});

// 3. Create screenshot record
await trpc.screenshots.create.mutate({ flowId, s3Key: key });
```

## Do NOT
- Modify files in `src/components/ui/` (ShadCN managed)
- Use `any` type
- Skip loading/error states
- Expose sensitive data in client components
- Make direct database calls from client
- Skip validation on API inputs
- Hardcode organization IDs

## Dependencies to Use
- Date handling: `date-fns`
- Icons: `lucide-react`
- Canvas: `react-konva`, `konva`
- Tables: `@tanstack/react-table`
- Drag & drop: `@dnd-kit/core`
- Rich text: `@tiptap/react`

## Environment Variables Required
See `.env.example` for all required variables.
Critical ones:
- `DATABASE_URL` - PostgreSQL connection
- `NEXTAUTH_SECRET` - Auth encryption key
- `AWS_*` - S3 configuration
- `LIVEBLOCKS_SECRET_KEY` - Real-time features
