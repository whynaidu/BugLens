# BugLens - Claude Code Development Prompts

Use these prompts sequentially with Claude Code to build the complete application.
Copy each prompt, run it, verify it works, then proceed to the next.

---

## PHASE 1: PROJECT FOUNDATION

### Prompt 1.1: Initialize Project
```
Create a new Next.js 14 project called "buglens" with the following configuration:

1. Initialize with:
   - TypeScript (strict mode)
   - TailwindCSS
   - ESLint
   - App Router
   - src/ directory

2. Install core dependencies:
   npm install @trpc/server @trpc/client @trpc/react-query @tanstack/react-query
   npm install @prisma/client prisma
   npm install next-auth@beta @auth/prisma-adapter
   npm install zod react-hook-form @hookform/resolvers
   npm install date-fns lucide-react
   npm install zustand nuqs
   npm install -D @types/node

3. Initialize ShadCN UI:
   npx shadcn@latest init
   - Style: Default
   - Base color: Slate
   - CSS variables: Yes

4. Add these ShadCN components:
   npx shadcn@latest add button card input label textarea select form dialog sheet alert-dialog table badge avatar skeleton sidebar breadcrumb tabs command dropdown-menu popover tooltip separator scroll-area sonner

5. Create the folder structure:
   src/
   ├── app/
   │   ├── (auth)/
   │   ├── (dashboard)/
   │   ├── (marketing)/
   │   └── api/
   ├── components/
   │   ├── ui/ (already created by ShadCN)
   │   ├── annotation/
   │   ├── bugs/
   │   ├── projects/
   │   ├── flows/
   │   ├── screenshots/
   │   ├── layout/
   │   ├── settings/
   │   └── shared/
   ├── server/
   │   ├── routers/
   │   └── services/
   ├── lib/
   │   └── validations/
   ├── hooks/
   ├── store/
   ├── types/
   └── workers/

6. Create .env.example with all required variables

7. Set up path aliases in tsconfig.json:
   "@/*": ["./src/*"]

8. Configure tailwind.config.ts for ShadCN
```

### Prompt 1.2: Database Schema
```
Set up Prisma with PostgreSQL and create the complete database schema:

1. Initialize Prisma:
   npx prisma init

2. Create the schema in prisma/schema.prisma with:

ENUMS:
- Role: ADMIN, PROJECT_MANAGER, DEVELOPER, TESTER
- BugStatus: OPEN, IN_PROGRESS, IN_REVIEW, RESOLVED, CLOSED, REOPENED
- BugSeverity: LOW, MEDIUM, HIGH, CRITICAL
- BugPriority: LOW, MEDIUM, HIGH, URGENT
- AnnotationType: RECTANGLE, CIRCLE, ARROW
- AuditAction: CREATED, UPDATED, STATUS_CHANGED, ASSIGNED, COMMENTED, etc.
- IntegrationType: JIRA, TRELLO, AZURE_DEVOPS, SLACK, TEAMS
- NotificationChannel: IN_APP, EMAIL, SLACK, TEAMS

MODELS:
- User (id, email, name, avatarUrl, hashedPassword, createdAt, updatedAt)
- Account (NextAuth OAuth accounts)
- Session (NextAuth sessions)
- VerificationToken
- Organization (id, name, slug, logoUrl, settings JSON, createdAt)
- Member (userId, organizationId, role, joinedAt) - unique compound key
- Invitation (email, organizationId, role, token, expiresAt)
- Project (id, organizationId, name, description, slug, color, isArchived)
- Flow (id, projectId, name, description, order)
- Screenshot (id, flowId, title, originalUrl, thumbnailUrl, previewUrl, s3Key, width, height, order)
- Annotation (id, screenshotId, bugId?, type, x, y, width?, height?, radius?, points JSON, stroke, strokeWidth)
- Bug (id, projectId, creatorId, assigneeId?, title, description, status, severity, priority, browserInfo JSON, externalId?, externalUrl?)
- Comment (id, bugId, authorId, content, createdAt)
- Attachment (id, bugId, fileName, fileUrl, s3Key, fileSize, mimeType)
- AuditLog (id, bugId, userId, action, details JSON, createdAt)
- Integration (id, organizationId, type, accessToken, refreshToken, config JSON, isActive)
- Notification (id, userId, type, title, message, data JSON, channel, isRead, createdAt)
- NotificationPreference (userId, eventType, channel, isEnabled)

3. Add proper indexes for:
   - Foreign keys
   - Frequently queried fields (status, slug, email)
   - Compound unique constraints

4. Create src/server/db.ts with Prisma client singleton

5. Add npm scripts:
   "db:push": "prisma db push"
   "db:migrate": "prisma migrate dev"
   "db:seed": "prisma db seed"
   "db:studio": "prisma studio"
```

### Prompt 1.3: tRPC Setup
```
Set up tRPC with Next.js App Router:

1. Create src/server/trpc.ts:
   - Initialize tRPC with superjson transformer
   - Create base procedure
   - Create protected procedure (requires auth)
   - Create org procedure (requires org membership)
   - Export router and procedure helpers

2. Create src/server/routers/index.ts:
   - Main app router combining all sub-routers
   - Export type AppRouter

3. Create src/app/api/trpc/[trpc]/route.ts:
   - Handle tRPC requests
   - Pass session context

4. Create src/lib/trpc.ts (client):
   - Create tRPC client hooks
   - Configure with React Query

5. Create src/components/providers.tsx:
   - QueryClientProvider
   - tRPC Provider
   - Session Provider
   - Sonner Toaster

6. Update src/app/layout.tsx to use Providers

7. Create empty router files in src/server/routers/:
   - organizations.ts
   - projects.ts
   - flows.ts
   - screenshots.ts
   - annotations.ts
   - bugs.ts
   - comments.ts
   - members.ts
   - notifications.ts
   - integrations.ts

Each router should export a createTRPCRouter({}) for now.
```

---

## PHASE 2: AUTHENTICATION

### Prompt 2.1: NextAuth Setup
```
Implement authentication with NextAuth.js v5:

1. Install: npm install next-auth@beta @auth/prisma-adapter bcryptjs
   npm install -D @types/bcryptjs

2. Create src/server/auth.ts:
   - Configure NextAuth with Prisma adapter
   - Add providers:
     a) Credentials (email/password)
     b) Google OAuth
     c) Microsoft Entra ID
   - Configure JWT session strategy
   - Add callbacks for jwt and session
   - Export auth, signIn, signOut, handlers

3. Create src/app/api/auth/[...nextauth]/route.ts:
   - Export GET and POST handlers

4. Create src/lib/validations/auth.ts:
   - loginSchema (email, password)
   - signupSchema (name, email, password, confirmPassword)
   - forgotPasswordSchema (email)

5. Create auth service in src/server/services/auth.ts:
   - hashPassword function
   - verifyPassword function
   - createUser function
   - getUserByEmail function

6. Update Providers component to include SessionProvider

7. Create src/hooks/use-auth.ts:
   - Custom hook for auth state
   - Expose session, user, isLoading
```

### Prompt 2.2: Auth Pages
```
Create authentication pages using ShadCN components:

1. Create src/app/(auth)/layout.tsx:
   - Centered layout with logo
   - Card container for auth forms
   - Redirect to dashboard if already logged in

2. Create src/app/(auth)/login/page.tsx:
   - Login form with email and password
   - "Forgot password?" link
   - OAuth buttons (Google, Microsoft)
   - "Don't have an account? Sign up" link
   - Use ShadCN Form, Input, Button, Card
   - Loading state on submit
   - Error handling with toast

3. Create src/app/(auth)/signup/page.tsx:
   - Registration form (name, email, password, confirm)
   - Password strength indicator
   - Terms acceptance checkbox
   - OAuth signup options
   - "Already have an account? Log in" link

4. Create src/app/(auth)/forgot-password/page.tsx:
   - Email input form
   - Success message after submission
   - "Back to login" link

5. Create src/components/auth/oauth-buttons.tsx:
   - Google sign-in button with icon
   - Microsoft sign-in button with icon
   - Divider with "or continue with"

6. Add proper form validation feedback
7. Implement loading states during authentication
8. Handle OAuth errors gracefully
```

### Prompt 2.3: Auth Middleware
```
Implement auth middleware and protection:

1. Create src/middleware.ts:
   - Protect /dashboard routes
   - Redirect unauthenticated users to /login
   - Allow public routes (/, /login, /signup, /pricing)

2. Create src/lib/auth-utils.ts:
   - getCurrentUser() - server component helper
   - requireAuth() - throw if not authenticated
   - requireRole(role) - check user role

3. Create protected API wrapper in src/server/trpc.ts:
   - protectedProcedure - requires valid session
   - Extract user from session in context

4. Create src/app/(dashboard)/layout.tsx:
   - Server component that checks auth
   - Redirect to /login if no session
   - Pass session to children via context

5. Create src/hooks/use-session.ts:
   - Client-side session hook
   - Auto-refresh on focus
   - Loading state handling
```

---

## PHASE 3: ORGANIZATION & MULTI-TENANCY

### Prompt 3.1: Organization CRUD
```
Implement organization management:

1. Create src/lib/validations/organization.ts:
   - createOrgSchema (name, generates slug)
   - updateOrgSchema (name, logoUrl, settings)

2. Create src/server/routers/organizations.ts:
   - create: Create org and add creator as ADMIN
   - update: Update org details (admin only)
   - getBySlug: Get org by slug
   - getUserOrganizations: Get all orgs user belongs to
   - delete: Soft delete org (admin only)

3. Create src/components/organizations/create-org-dialog.tsx:
   - Dialog with form
   - Name input (auto-generates slug preview)
   - Logo upload (optional)
   - Submit creates org and redirects

4. Create src/app/(dashboard)/select-organization/page.tsx:
   - Shows list of user's organizations
   - Card for each org with logo and name
   - "Create new organization" button
   - Empty state if no organizations

5. Create src/components/layout/org-switcher.tsx:
   - Dropdown showing current org
   - List of other orgs to switch
   - "Create organization" option
   - Uses ShadCN DropdownMenu
```

### Prompt 3.2: Member Management
```
Implement member and invitation management:

1. Create src/lib/validations/member.ts:
   - inviteSchema (email, role)
   - updateRoleSchema (memberId, role)

2. Create src/server/routers/members.ts:
   - getByOrganization: List all members
   - invite: Create invitation and send email
   - acceptInvite: Join org from invitation token
   - updateRole: Change member role (admin only)
   - remove: Remove member from org
   - leave: Leave organization

3. Create src/server/services/email.ts:
   - Configure Resend client
   - sendInvitationEmail function
   - Email template for invitations

4. Create src/components/settings/members-table.tsx:
   - Table with member list
   - Columns: Avatar, Name, Email, Role, Actions
   - Role dropdown to change role
   - Remove button with confirmation
   - Use ShadCN Table and DropdownMenu

5. Create src/components/settings/invite-dialog.tsx:
   - Email input
   - Role selector
   - Pending invitations list
   - Cancel invitation option

6. Create src/app/(dashboard)/[orgSlug]/settings/members/page.tsx:
   - Members table
   - Invite button opening dialog
   - Pending invitations section
```

### Prompt 3.3: Dashboard Layout
```
Create the main dashboard layout:

1. Create src/components/layout/app-sidebar.tsx:
   - Use ShadCN Sidebar component
   - Logo at top
   - Navigation sections:
     - Dashboard (home icon)
     - Projects (folder icon)
     - Bugs (bug icon)
     - Reports (chart icon)
   - Settings at bottom
   - Collapsible on mobile

2. Create src/components/layout/header.tsx:
   - Org switcher on left
   - Search bar in center (Command+K)
   - Notifications bell
   - User menu on right

3. Create src/components/layout/user-menu.tsx:
   - Avatar with dropdown
   - User name and email
   - Theme toggle
   - Profile settings link
   - Sign out option

4. Create src/components/layout/notifications-popover.tsx:
   - Bell icon with unread count badge
   - Popover with notification list
   - Mark as read on click
   - "View all" link

5. Create src/app/(dashboard)/[orgSlug]/layout.tsx:
   - Validate org membership
   - SidebarProvider wrapper
   - Sidebar + Header + Main content area
   - Pass org context to children

6. Create src/app/(dashboard)/[orgSlug]/page.tsx:
   - Dashboard home with stats cards
   - Recent bugs list
   - Recent activity feed
   - Quick actions
```

---

## PHASE 4: PROJECTS & FLOWS

### Prompt 4.1: Project Management
```
Implement project CRUD:

1. Create src/lib/validations/project.ts:
   - createProjectSchema (name, description, color)
   - updateProjectSchema

2. Create src/server/routers/projects.ts:
   - create: Create project in organization
   - update: Update project details
   - archive: Archive/unarchive project
   - delete: Hard delete (admin only)
   - getByOrganization: List org projects
   - getById: Get single project with stats

3. Create src/components/projects/project-card.tsx:
   - Card showing project name, color, description
   - Bug count and status summary
   - Last updated date
   - Click to navigate
   - Dropdown menu for edit/archive

4. Create src/components/projects/project-list.tsx:
   - Grid of project cards
   - Search/filter bar
   - Empty state with CTA
   - Loading skeletons

5. Create src/components/projects/project-form.tsx:
   - Name input
   - Description textarea
   - Color picker (preset colors)
   - Used in both create dialog and settings

6. Create src/app/(dashboard)/[orgSlug]/projects/page.tsx:
   - Project list with filters
   - "New Project" button
   - Archived projects toggle

7. Create src/app/(dashboard)/[orgSlug]/projects/[projectId]/page.tsx:
   - Project overview
   - Stats cards (total bugs, open, resolved)
   - Flows list
   - Recent activity
```

### Prompt 4.2: Flow Management
```
Implement flow (sub-folder) management:

1. Create src/lib/validations/flow.ts:
   - createFlowSchema (name, description)
   - updateFlowSchema
   - reorderFlowsSchema (flowIds array)

2. Install: npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

3. Create src/server/routers/flows.ts:
   - create: Create flow in project
   - update: Update flow details
   - delete: Delete flow and contents
   - reorder: Update flow order
   - getByProject: List project flows

4. Create src/components/flows/flow-card.tsx:
   - Card with flow name and description
   - Screenshot count
   - Bug count
   - Drag handle for reordering

5. Create src/components/flows/flow-list.tsx:
   - Sortable list using dnd-kit
   - Drag to reorder
   - Empty state

6. Create src/components/flows/flow-form.tsx:
   - Name input
   - Description textarea
   - Used in dialog

7. Create src/app/(dashboard)/[orgSlug]/projects/[projectId]/flows/page.tsx:
   - Flow list with drag-drop reordering
   - "Add Flow" button
   - Shows flow cards with stats

8. Create src/app/(dashboard)/[orgSlug]/projects/[projectId]/flows/[flowId]/page.tsx:
   - Flow detail view
   - Screenshot grid
   - Upload button
   - Breadcrumb navigation
```

---

## PHASE 5: SCREENSHOTS & UPLOAD

### Prompt 5.1: S3 Setup
```
Set up AWS S3 for screenshot storage:

1. Install: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner

2. Create src/server/services/s3.ts:
   - Initialize S3 client with credentials
   - generateUploadUrl(key, contentType) - presigned PUT URL
   - generateDownloadUrl(key) - presigned GET URL
   - deleteObject(key)
   - getObjectMetadata(key)

3. Create src/server/routers/screenshots.ts:
   - getUploadUrl: Generate presigned URL
     - Input: fileName, contentType, flowId
     - Output: uploadUrl, key
   - create: Create screenshot record after upload
   - update: Update title, description
   - delete: Delete from S3 and database
   - reorder: Update screenshot order
   - getByFlow: List flow screenshots

4. S3 bucket structure:
   /{orgId}/{projectId}/{flowId}/{screenshotId}/
     - original.{ext}
     - thumbnail.webp
     - preview.webp

5. Create src/lib/constants.ts:
   - MAX_FILE_SIZE = 10MB
   - ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
   - THUMBNAIL_SIZE = { width: 150, height: 150 }
   - PREVIEW_SIZE = { width: 600, height: 400 }
```

### Prompt 5.2: Screenshot Upload UI
```
Implement screenshot upload interface:

1. Create src/components/shared/file-upload.tsx:
   - Drag and drop zone
   - Click to browse
   - File type validation
   - Size validation
   - Progress indicator
   - Preview of selected file
   - Uses ShadCN Card styling

2. Create src/hooks/use-upload.ts:
   - Custom hook for S3 upload flow
   - States: idle, getting-url, uploading, processing, complete, error
   - Progress percentage
   - Error handling
   - Returns: upload(file), progress, status, error

3. Create src/components/screenshots/screenshot-upload.tsx:
   - Uses FileUpload component
   - Multiple file support
   - Upload queue with individual progress
   - Success/error feedback
   - Auto-close on complete

4. Create src/components/screenshots/screenshot-card.tsx:
   - Thumbnail image
   - Title (editable on click)
   - Bug count badge
   - Hover actions (view, delete)
   - Loading skeleton variant

5. Create src/components/screenshots/screenshot-grid.tsx:
   - Responsive grid of screenshot cards
   - Drag to reorder (dnd-kit)
   - Empty state
   - Loading state with skeletons

6. Update flow page to include:
   - Upload button/zone
   - Screenshot grid
   - Bulk actions toolbar
```

### Prompt 5.3: Screenshot Viewer
```
Create screenshot viewer with annotation canvas:

1. Install: npm install react-konva konva

2. Create src/app/(dashboard)/[orgSlug]/projects/[projectId]/flows/[flowId]/screenshots/[screenshotId]/page.tsx:
   - Full-screen screenshot view
   - Annotation canvas overlay
   - Toolbar for annotation tools
   - Bug list sidebar
   - Keyboard shortcuts

3. Create src/components/screenshots/screenshot-viewer.tsx:
   - Full image display
   - Zoom controls (mouse wheel)
   - Pan support (drag when zoomed)
   - Fit to screen option
   - Previous/Next navigation

4. Create basic canvas structure:
   - Image as background layer
   - Annotations layer on top
   - Selection layer for handles

5. Create src/store/annotation-store.ts (Zustand):
   - selectedTool: 'select' | 'rectangle' | 'circle' | 'arrow'
   - selectedAnnotationId: string | null
   - annotations: Annotation[]
   - isDrawing: boolean
   - Actions: setTool, selectAnnotation, addAnnotation, updateAnnotation, deleteAnnotation
```

---

## PHASE 6: ANNOTATION CANVAS

### Prompt 6.1: Core Annotation Canvas
```
Implement the annotation canvas with React-Konva:

1. Create src/types/annotation.ts:
   interface Annotation {
     id: string;
     type: 'RECTANGLE' | 'CIRCLE' | 'ARROW';
     x: number;  // 0-1 normalized
     y: number;  // 0-1 normalized
     width?: number;
     height?: number;
     radius?: number;
     points?: number[]; // For arrow
     stroke: string;
     strokeWidth: number;
     bugId?: string;
   }

2. Create src/components/annotation/canvas.tsx:
   - React-Konva Stage component
   - Image layer (background)
   - Annotations layer
   - Handle mouse events for drawing
   - Normalize coordinates on save
   - Scale coordinates on render

3. Create src/components/annotation/toolbar.tsx:
   - Tool buttons: Select, Rectangle, Circle, Arrow
   - Delete button (when selected)
   - Zoom controls
   - Undo/Redo buttons
   - Uses ShadCN ToggleGroup

4. Create src/components/annotation/shapes/rectangle.tsx:
   - Konva Rect component
   - Red stroke (#EF4444)
   - Transparent fill
   - Click to select
   - Drag to move when selected
   - Resize handles via Transformer

5. Handle drawing flow:
   - MouseDown: Start shape at position
   - MouseMove: Update shape dimensions
   - MouseUp: Finish shape, save to state
```

### Prompt 6.2: All Annotation Shapes
```
Implement all annotation shape types:

1. Create src/components/annotation/shapes/circle.tsx:
   - Konva Circle/Ellipse component
   - Red stroke
   - Calculated from drag (center + radius)
   - Resize handles

2. Create src/components/annotation/shapes/arrow.tsx:
   - Konva Arrow component
   - Red stroke with arrowhead
   - Points: [startX, startY, endX, endY]
   - Draggable endpoints
   - Rotate by dragging end

3. Create src/components/annotation/shapes/index.tsx:
   - AnnotationShape component
   - Renders correct shape based on type
   - Handles selection state
   - Passes through event handlers

4. Create src/components/annotation/transformer-layer.tsx:
   - Konva Transformer for selected shape
   - Resize anchors
   - Rotation handle (for arrows)
   - Boundary constraints

5. Update canvas.tsx:
   - Render all annotations from store
   - Handle shape selection
   - Keyboard shortcuts:
     - Delete/Backspace: Delete selected
     - Escape: Deselect
     - Ctrl+Z: Undo
     - Ctrl+Y: Redo
```

### Prompt 6.3: Annotation Persistence
```
Implement annotation saving and loading:

1. Update src/server/routers/annotations.ts:
   - create: Create annotation
   - update: Update annotation position/size
   - delete: Delete annotation
   - getByScreenshot: Load all annotations
   - linkToBug: Connect annotation to bug

2. Create src/lib/validations/annotation.ts:
   - createAnnotationSchema
   - updateAnnotationSchema
   - Validate coordinate ranges (0-1)

3. Update annotation-store.ts:
   - Add sync actions
   - Track unsaved changes
   - Debounced auto-save

4. Create src/hooks/use-annotation.ts:
   - Load annotations for screenshot
   - Save annotation changes
   - Delete annotations
   - Optimistic updates
   - Error rollback

5. Visual indicators on canvas:
   - Saving spinner
   - Saved checkmark
   - Error indicator with retry

6. Update canvas to:
   - Load annotations on mount
   - Auto-save on change (debounced)
   - Show loading state
   - Handle errors gracefully
```

---

## PHASE 7: BUG MANAGEMENT

### Prompt 7.1: Bug Dialog
```
Create the bug creation/edit dialog:

1. Create src/lib/validations/bug.ts:
   - createBugSchema (title, description, severity, priority)
   - updateBugSchema
   - updateStatusSchema

2. Create src/components/annotation/bug-dialog.tsx:
   - ShadCN Dialog component
   - Opens when annotation is clicked
   - Form fields:
     - Title (required)
     - Description (textarea with markdown)
     - Severity dropdown (Low, Medium, High, Critical)
     - Priority dropdown (Low, Medium, High, Urgent)
     - Assignee combobox (search team members)
   - Show linked annotation preview
   - Save creates/updates bug
   - Cancel button
   - Delete bug option (if exists)

3. Update canvas.tsx:
   - Double-click annotation opens dialog
   - Or click annotation + press Enter
   - Pass annotation data to dialog
   - Refresh on save

4. Create src/server/routers/bugs.ts:
   - create: Create bug, link to annotation, create audit log
   - update: Update bug details, create audit log
   - delete: Delete bug (soft delete)
   - getById: Get single bug with all relations
   - getByProject: List bugs with filters

5. Visual indicator on annotation:
   - Different style if linked to bug
   - Show bug ID number on hover
   - Color coding by severity
```

### Prompt 7.2: Bug List Page
```
Create bug listing and filtering:

1. Create src/app/(dashboard)/[orgSlug]/projects/[projectId]/bugs/page.tsx:
   - Full-width bug list
   - Filters sidebar
   - Pagination
   - Table or Kanban toggle

2. Create src/components/bugs/bug-list.tsx:
   - TanStack Table integration
   - Columns: ID, Title, Status, Severity, Priority, Assignee, Created, Actions
   - Sortable columns
   - Row click to navigate
   - Bulk selection
   - Bulk actions (change status, assign)

3. Create src/components/bugs/bug-filters.tsx:
   - Status multi-select
   - Severity multi-select
   - Priority multi-select
   - Assignee filter
   - Date range picker
   - Search by title/description
   - Clear all filters

4. Create src/components/bugs/status-badge.tsx:
   - Badge with status-specific colors:
     - OPEN: slate/gray
     - IN_PROGRESS: blue
     - IN_REVIEW: yellow
     - RESOLVED: green
     - CLOSED: gray muted
     - REOPENED: red
   - Use ShadCN Badge

5. Create src/components/bugs/severity-badge.tsx:
   - Color-coded badges:
     - LOW: green
     - MEDIUM: yellow
     - HIGH: orange
     - CRITICAL: red

6. URL-based filters using nuqs:
   - ?status=OPEN,IN_PROGRESS
   - ?severity=HIGH,CRITICAL
   - ?assignee=userId
   - Shareable filtered URLs
```

### Prompt 7.3: Bug Detail Page
```
Create the bug detail page:

1. Create src/app/(dashboard)/[orgSlug]/projects/[projectId]/bugs/[bugId]/page.tsx:
   - Bug header with title (editable)
   - Status workflow buttons
   - Two-column layout:
     - Left: Screenshot with annotation highlighted
     - Right: Details + Activity

2. Create src/components/bugs/bug-detail.tsx:
   - Bug metadata cards
   - Screenshot preview with annotation
   - Status change buttons based on workflow:
     - OPEN → Start Progress
     - IN_PROGRESS → Submit for Review
     - IN_REVIEW → Resolve / Return
     - RESOLVED → Close / Reopen
   - Edit button for details

3. Create src/components/bugs/bug-sidebar.tsx:
   - Assignee (changeable)
   - Severity (changeable)
   - Priority (changeable)
   - Reporter info
   - Created date
   - Last updated
   - External link (if synced)

4. Create status transition logic:
   - Validate allowed transitions
   - Permission checks by role
   - Create audit log on change

5. Browser/device info display:
   - Auto-captured on bug creation
   - Show browser name, version, OS
   - Screen resolution

6. Add breadcrumb navigation:
   - Org > Project > Bugs > Bug #ID
```

---

## PHASE 8: AUDIT & COMMENTS

### Prompt 8.1: Audit Timeline
```
Implement audit logging and timeline:

1. Create src/server/services/audit.ts:
   - logAction(bugId, userId, action, details)
   - Automatically called on bug changes
   - Store old/new values for changes

2. Update bug routers to log:
   - Bug created
   - Status changed (with from/to)
   - Assigned/unassigned
   - Severity/priority changed
   - Title/description edited
   - Comment added
   - Annotation added/modified
   - Synced to external tool

3. Create src/components/bugs/audit-timeline.tsx:
   - Chronological list of events
   - User avatar and name
   - Relative timestamp ("2 hours ago")
   - Formatted change messages:
     - "changed status from Open to In Progress"
     - "assigned to John Doe"
     - "added a comment"
   - Different icons per action type

4. Create src/server/routers/auditLogs.ts:
   - getByBug: Paginated audit log list
   - Get with user details

5. Add to bug detail page:
   - "Activity" tab
   - Shows timeline
   - Load more pagination
```

### Prompt 8.2: Comments System
```
Implement bug comments:

1. Create src/lib/validations/comment.ts:
   - createCommentSchema (content)
   - updateCommentSchema

2. Create src/server/routers/comments.ts:
   - create: Add comment, log to audit
   - update: Edit own comment
   - delete: Delete own comment
   - getByBug: List bug comments

3. Create src/components/bugs/comment-input.tsx:
   - Textarea with markdown support
   - @mention autocomplete
   - Submit button
   - Cancel button
   - Preview toggle

4. Create src/components/bugs/comment-item.tsx:
   - User avatar and name
   - Timestamp
   - Markdown rendered content
   - Edit/Delete for own comments
   - Reply button (optional)

5. Create src/components/bugs/comments-list.tsx:
   - List of CommentItem components
   - CommentInput at bottom
   - Empty state
   - Loading state

6. Add to bug detail page:
   - "Comments" section
   - Real-time updates (if Liveblocks ready)

7. Mention notifications:
   - Parse @username in comments
   - Create notification for mentioned user
```

---

## PHASE 9: REAL-TIME COLLABORATION

### Prompt 9.1: Liveblocks Setup
```
Set up Liveblocks for real-time features:

1. Install: npm install @liveblocks/client @liveblocks/react @liveblocks/yjs yjs

2. Create src/lib/liveblocks.ts:
   - Initialize Liveblocks client
   - Configure auth endpoint
   - Define types:
     - Presence: cursor position, selectedAnnotationId
     - Storage: annotations Map

3. Create src/app/api/liveblocks-auth/route.ts:
   - Verify user session
   - Return Liveblocks token with user info
   - Include room permissions

4. Create src/components/providers/liveblocks-provider.tsx:
   - RoomProvider wrapper
   - Room ID based on screenshot ID
   - Initial presence and storage

5. Create src/types/liveblocks.d.ts:
   - TypeScript declarations for Liveblocks

6. Update screenshot viewer page:
   - Wrap with LiveblocksProvider
   - Room per screenshot: `screenshot:${screenshotId}`
```

### Prompt 9.2: Collaborative Cursors
```
Implement collaborative cursor display:

1. Create src/components/annotation/cursors.tsx:
   - Show other users' cursors on canvas
   - Cursor with user name label
   - Unique color per user
   - Smooth movement animation

2. Update canvas to track cursor:
   - Send cursor position on mouse move
   - Throttle updates (60fps max)
   - Clear on mouse leave

3. Create src/hooks/use-presence.ts:
   - Track local cursor position
   - Read other users' presence
   - Update presence on change

4. Create src/components/annotation/presence-avatars.tsx:
   - Show avatars of users viewing screenshot
   - Tooltip with names
   - "2 others viewing" for overflow
   - Use ShadCN Avatar

5. Add presence to header:
   - Show who's currently viewing
   - Animate when users join/leave

6. Toast notifications:
   - "[User] joined"
   - "[User] left"
```

### Prompt 9.3: Collaborative Annotations
```
Implement real-time annotation sync:

1. Update annotation-store to use Liveblocks storage:
   - Store annotations in Yjs Map
   - Sync changes automatically
   - Handle conflicts with CRDT

2. Create src/hooks/use-collaborative-annotations.ts:
   - Subscribe to storage changes
   - Local mutations sync to others
   - Handle reconnection

3. Update canvas.tsx:
   - Use collaborative store
   - Show saving indicator
   - Show sync status

4. Visual feedback:
   - Highlight annotation being edited by others
   - Show who is editing
   - Disable editing while other user has focus

5. Conflict handling:
   - Last-write-wins for positions
   - Preserve both if simultaneous create
   - Visual indicator of external changes

6. Offline support:
   - Queue changes when offline
   - Sync when reconnected
   - Show offline indicator
```

---

## PHASE 10: NOTIFICATIONS

### Prompt 10.1: Notification System Backend
```
Set up notification infrastructure:

1. Install: npm install bullmq ioredis resend

2. Create src/server/services/queue.ts:
   - Initialize BullMQ with Redis
   - Create notification queue
   - Define job types

3. Create src/workers/notification-worker.ts:
   - Process notification jobs
   - Route to appropriate channel
   - Handle retries

4. Create src/server/services/email.ts:
   - Configure Resend client
   - Email templates:
     - Bug assigned
     - New comment
     - Status changed
     - Weekly digest
   - HTML email with styling

5. Create notification service:
   - createNotification(userId, type, data)
   - Check user preferences
   - Queue for delivery

6. Update src/server/routers/notifications.ts:
   - getUnread: List unread notifications
   - getAll: Paginated list
   - markAsRead: Single notification
   - markAllAsRead: Clear all
   - getPreferences: User settings
   - updatePreferences: Change settings

7. Trigger notifications on:
   - Bug assigned to user
   - Comment on user's bug
   - Status change on assigned bug
   - Mentioned in comment
```

### Prompt 10.2: Notification UI
```
Create notification user interface:

1. Create src/components/layout/notifications-popover.tsx:
   - Bell icon button
   - Unread count badge
   - Popover with notification list
   - Mark as read on click
   - "Mark all as read" button
   - "View all" link
   - Empty state

2. Create src/components/notifications/notification-item.tsx:
   - Icon based on type
   - Title and message
   - Relative timestamp
   - Unread indicator dot
   - Click to navigate to bug

3. Create src/app/(dashboard)/[orgSlug]/notifications/page.tsx:
   - Full notifications list
   - Filter by type
   - Date grouping
   - Pagination

4. Create src/components/settings/notification-settings.tsx:
   - Toggle per event type
   - Toggle per channel (in-app, email)
   - Organization override option
   - Save preferences

5. Real-time notification updates:
   - Poll every 30 seconds
   - Or use Liveblocks for instant
   - Toast for new notifications

6. Add notification preferences to settings:
   - /settings/notifications page
   - Event type toggles
   - Email digest frequency
```

### Prompt 10.3: Slack & Teams Integration
```
Implement Slack and Teams notifications:

1. Install: npm install @slack/web-api @slack/oauth

2. Create src/server/services/slack.ts:
   - OAuth flow for workspace connection
   - postMessage with Block Kit formatting
   - Channel listing

3. Create src/server/services/teams.ts:
   - Webhook URL configuration
   - Adaptive Card formatting
   - Rate limiting (4 req/sec)

4. Create integration settings UI:
   - src/app/(dashboard)/[orgSlug]/settings/integrations/page.tsx
   - Connect Slack button (OAuth flow)
   - Teams webhook URL input
   - Channel selection per project
   - Test notification button

5. Message templates:
   - Bug created: Title, severity, link
   - Bug assigned: Assignee mention
   - Status changed: Old → New status
   - Comment added: Comment preview

6. Update notification worker:
   - Check if Slack/Teams enabled
   - Format appropriate message
   - Send to configured channel
   - Handle errors gracefully

7. Add Slack/Teams to notification preferences:
   - Enable/disable per event type
   - Channel override per project
```

---

## PHASE 11: EXTERNAL INTEGRATIONS

### Prompt 11.1: Jira Integration
```
Implement Jira Cloud integration:

1. Create src/server/services/jira.ts:
   - OAuth 2.0 (3LO) flow
   - Token refresh logic
   - API methods:
     - getProjects
     - getIssueTypes
     - createIssue
     - updateIssue
     - getIssue
     - addComment

2. Create src/app/api/integrations/jira/callback/route.ts:
   - OAuth callback handler
   - Store tokens securely

3. Create src/server/routers/integrations.ts:
   - connectJira: Start OAuth flow
   - disconnectJira: Remove tokens
   - getJiraConfig: Get mapping
   - updateJiraMapping: Field mapping
   - syncBugToJira: Push bug to Jira
   - importFromJira: Pull issue to bug

4. Create src/components/settings/jira-settings.tsx:
   - Connect button
   - Project selector
   - Issue type mapping
   - Field mapping:
     - Severity → Priority
     - Status → Status
   - Sync direction (push/pull/both)

5. Two-way sync:
   - Push on bug create/update
   - Webhook for Jira changes
   - Conflict detection

6. Add "Sync to Jira" button on bug detail
```

### Prompt 11.2: Trello & Azure DevOps
```
Implement Trello and Azure DevOps integrations:

1. Create src/server/services/trello.ts:
   - OAuth 1.0a authentication
   - API methods:
     - getBoards
     - getLists
     - createCard
     - updateCard
     - addAttachment

2. Create src/server/services/azure-devops.ts:
   - OAuth authentication
   - API methods:
     - getProjects
     - getWorkItemTypes
     - createWorkItem
     - updateWorkItem

3. Add to integrations router:
   - connectTrello / disconnectTrello
   - connectAzureDevOps / disconnectAzureDevOps
   - Sync methods for each

4. Create settings UI:
   - src/components/settings/trello-settings.tsx
   - src/components/settings/azure-devops-settings.tsx
   - Similar pattern to Jira

5. Webhook handlers:
   - /api/webhooks/trello
   - /api/webhooks/azure-devops
   - Verify signatures
   - Update local bugs

6. Update bug detail:
   - "Sync to..." dropdown
   - Show external link when synced
   - Sync status indicator
```

---

## PHASE 12: EXPORT & POLISH

### Prompt 12.1: Export Functionality
```
Implement PDF and Excel export:

1. Install: npm install puppeteer exceljs

2. Create src/server/services/export.ts:
   - generatePDF(projectId, filters)
   - generateExcel(projectId, filters)

3. PDF Export (Puppeteer):
   - Create HTML template
   - Project header with stats
   - Bug list with screenshots
   - Annotations highlighted on images
   - Page breaks between bugs
   - Styled with brand colors

4. Excel Export (ExcelJS):
   - Bug list worksheet
   - Columns: ID, Title, Status, Severity, Priority, Assignee, Created, Description
   - Conditional formatting for severity
   - Embedded thumbnail images
   - Additional sheets: By Status, By Flow

5. Create export API routes:
   - /api/export/pdf
   - /api/export/excel
   - Queue job and return job ID
   - Poll for completion

6. Create src/components/projects/export-dialog.tsx:
   - Format selection (PDF/Excel)
   - Date range filter
   - Status filter
   - Include screenshots toggle
   - Generate button
   - Progress indicator
   - Download link when ready

7. Store exports in S3:
   - 24-hour expiry
   - Presigned download URLs
```

### Prompt 12.2: Final Polish
```
Add final polish and optimizations:

1. Performance:
   - Add React Query cache config
   - Implement virtual scrolling for long lists
   - Lazy load images with blur placeholder
   - Add skeleton loaders everywhere
   - Optimize bundle size

2. Error handling:
   - Global error boundary component
   - tRPC error handling with toast
   - Form validation error display
   - Offline detection banner
   - 404 and 500 error pages

3. Loading states:
   - Page-level loading.tsx files
   - Component-level skeletons
   - Button loading spinners
   - Optimistic updates

4. Empty states:
   - No projects
   - No bugs
   - No search results
   - Illustrated SVGs
   - Clear CTAs

5. Accessibility:
   - Keyboard navigation
   - ARIA labels on interactive elements
   - Focus management in dialogs
   - Skip links
   - Color contrast checks

6. Dark mode:
   - Install next-themes
   - Theme toggle in header
   - Persist preference
   - System preference detection
   - Test all ShadCN components

7. Mobile responsiveness:
   - Responsive sidebar (sheet on mobile)
   - Mobile-friendly bug list
   - Touch-friendly annotation (future)
   - Breakpoint testing
```

### Prompt 12.3: Testing & Documentation
```
Add testing and documentation:

1. Install: npm install -D vitest @testing-library/react @testing-library/jest-dom playwright

2. Unit tests (Vitest):
   - src/lib/*.test.ts
   - src/server/services/*.test.ts
   - Test utilities and helpers
   - Test validation schemas

3. Integration tests:
   - src/server/routers/*.test.ts
   - Test tRPC procedures
   - Mock database with Prisma

4. E2E tests (Playwright):
   - tests/auth.spec.ts - Login/signup flow
   - tests/bugs.spec.ts - Bug CRUD
   - tests/annotation.spec.ts - Annotation flow
   - Critical user journeys

5. Documentation:
   - README.md with setup instructions
   - API documentation
   - Component storybook (optional)
   - Architecture decisions

6. CI/CD:
   - GitHub Actions workflow
   - Run tests on PR
   - Type checking
   - Lint checking
   - Preview deployments

7. Add npm scripts:
   "test": "vitest"
   "test:coverage": "vitest --coverage"
   "test:e2e": "playwright test"
```

---

## USAGE NOTES

1. **Run prompts sequentially** - Each builds on the previous
2. **Verify before proceeding** - Test each feature works
3. **Commit after each prompt** - Easy rollback if needed
4. **Customize as needed** - Adjust to your preferences
5. **Read errors carefully** - Fix issues before continuing

## Tips for Claude Code

- If something fails, ask Claude to fix it specifically
- Use "continue from where we left off" if interrupted
- Ask Claude to explain code if unclear
- Request tests for complex logic
- Ask for optimization suggestions after features work
