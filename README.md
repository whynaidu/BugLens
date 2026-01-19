# BugLens - Visual Bug Tracking Platform

A multi-tenant visual bug tracking and annotation platform that allows testers to capture screenshots, annotate bugs visually, and collaborate with developers in real-time.

## Features

- **Visual Bug Reporting**: Capture screenshots and annotate bugs with drawing tools (rectangles, circles, arrows, freehand)
- **Real-time Collaboration**: Powered by Liveblocks and Yjs for real-time updates
- **Multi-tenant Architecture**: Organization-based isolation with role-based access control
- **External Integrations**: Sync bugs with Jira, Trello, and Azure DevOps
- **Export Capabilities**: Generate PDF reports and Excel spreadsheets
- **Dark Mode**: Full dark mode support with system preference detection
- **Notifications**: In-app, email, Slack, and Teams notifications

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, TailwindCSS
- **UI Library**: ShadCN UI
- **Backend**: tRPC for type-safe APIs, Prisma ORM
- **Database**: PostgreSQL
- **Real-time**: Liveblocks + Yjs
- **Storage**: AWS S3 + CloudFront CDN
- **Auth**: NextAuth.js v5 (Google, Microsoft, Email/Password)
- **Queue**: BullMQ + Redis
- **Email**: Resend

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis (for background jobs)
- AWS account (for S3 storage)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-org/buglens.git
cd buglens
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/buglens"

# NextAuth
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# OAuth Providers (optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
MICROSOFT_CLIENT_ID=""
MICROSOFT_CLIENT_SECRET=""

# AWS S3
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
AWS_REGION="us-east-1"
AWS_S3_BUCKET=""
AWS_CLOUDFRONT_DOMAIN=""

# Liveblocks (for real-time collaboration)
LIVEBLOCKS_SECRET_KEY=""

# Redis (for background jobs)
REDIS_URL="redis://localhost:6379"

# Email (Resend)
RESEND_API_KEY=""

# External Integrations (optional)
JIRA_CLIENT_ID=""
JIRA_CLIENT_SECRET=""
TRELLO_API_KEY=""
AZURE_DEVOPS_CLIENT_ID=""
AZURE_DEVOPS_CLIENT_SECRET=""
SLACK_CLIENT_ID=""
SLACK_CLIENT_SECRET=""
```

### 4. Set up the database

```bash
# Push the schema to the database
npm run db:push

# Seed the database (optional)
npm run db:seed
```

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the application.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Create production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript type checking |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:coverage` | Run tests with coverage |
| `npm run test:e2e` | Run E2E tests (Playwright) |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed` | Seed the database |
| `npm run db:studio` | Open Prisma Studio |

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
│   ├── ui/                # ShadCN components
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
│   └── permissions.ts     # CASL abilities
├── hooks/                 # Custom React hooks
├── store/                 # Zustand stores
├── types/                 # TypeScript types
└── workers/               # BullMQ workers
```

## User Roles

| Role | Permissions |
|------|-------------|
| ADMIN | Full access to everything |
| PROJECT_MANAGER | Manage projects, assign bugs, view reports |
| DEVELOPER | View/update assigned bugs, add comments |
| TESTER | Create bugs, upload screenshots, annotate |

## API Documentation

BugLens uses tRPC for type-safe API calls. All procedures are available under `/api/trpc`.

### Key Routers

- `auth` - Authentication procedures
- `organizations` - Organization management
- `members` - Team member management
- `projects` - Project CRUD operations
- `flows` - Testing flow management
- `screenshots` - Screenshot upload and management
- `annotations` - Annotation CRUD operations
- `bugs` - Bug tracking and management
- `comments` - Bug comments
- `integrations` - External service integrations
- `notifications` - Notification management

## Testing

### Unit Tests (Vitest)

```bash
# Run all unit tests
npm run test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test -- --watch
```

### E2E Tests (Playwright)

```bash
# Install browsers
npx playwright install

# Run E2E tests
npm run test:e2e

# Run with UI
npx playwright test --ui
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the project in Vercel
3. Configure environment variables
4. Deploy

### Docker

```bash
# Build the image
docker build -t buglens .

# Run the container
docker run -p 3000:3000 --env-file .env buglens
```

## External Integrations

### Jira

1. Create an OAuth 2.0 app in Atlassian Developer Console
2. Add the callback URL: `https://your-domain.com/api/integrations/jira/callback`
3. Configure `JIRA_CLIENT_ID` and `JIRA_CLIENT_SECRET`

### Trello

1. Get your API key from Trello Developer Portal
2. Configure `TRELLO_API_KEY`

### Azure DevOps

1. Register an application in Azure Portal
2. Add the callback URL: `https://your-domain.com/api/integrations/azure-devops/callback`
3. Configure `AZURE_DEVOPS_CLIENT_ID` and `AZURE_DEVOPS_CLIENT_SECRET`

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- Documentation: [docs.buglens.com](https://docs.buglens.com)
- Issues: [GitHub Issues](https://github.com/your-org/buglens/issues)
- Email: support@buglens.com
