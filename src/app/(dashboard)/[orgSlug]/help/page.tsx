import Link from "next/link";
import {
  Bug,
  FolderKanban,
  Camera,
  Users,
  MessageSquare,
  BarChart3,
  HelpCircle,
  ExternalLink,
  BookOpen,
  Keyboard,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

const features = [
  {
    title: "Projects",
    description: "Organize your work into projects. Each project can have multiple test flows and bugs.",
    icon: FolderKanban,
  },
  {
    title: "Test Flows",
    description: "Create test flows to document user journeys. Capture screenshots at each step.",
    icon: Camera,
  },
  {
    title: "Bug Tracking",
    description: "Report bugs with visual annotations. Track status, severity, and priority.",
    icon: Bug,
  },
  {
    title: "Team Collaboration",
    description: "Invite team members, assign bugs, and collaborate with comments.",
    icon: Users,
  },
  {
    title: "Comments & Discussion",
    description: "Discuss bugs with your team using threaded comments and mentions.",
    icon: MessageSquare,
  },
  {
    title: "Reports & Analytics",
    description: "Track bug trends, resolution rates, and team performance.",
    icon: BarChart3,
  },
];

const faqs = [
  {
    question: "How do I create a new bug?",
    answer: "You can create a bug by clicking the 'Report Bug' button in the dashboard, or by annotating a screenshot in a test flow and clicking on the annotation to create a bug from it.",
  },
  {
    question: "How do I annotate screenshots?",
    answer: "Open a screenshot in the viewer and use the drawing tools (rectangle, circle, arrow, freehand) to highlight areas. Click on an annotation to create a bug or view linked bugs.",
  },
  {
    question: "How do I invite team members?",
    answer: "Go to Settings > Members and click 'Invite Member'. Enter their email address and select their role (Admin, Project Manager, Developer, or Tester).",
  },
  {
    question: "What are the different user roles?",
    answer: "Admin: Full access to everything. Project Manager: Manage projects and assign bugs. Developer: View and update assigned bugs. Tester: Create bugs and upload screenshots.",
  },
  {
    question: "How do I change bug status?",
    answer: "Open a bug and use the status dropdown in the sidebar to change its status. Status transitions follow a workflow: Open → In Progress → In Review → Resolved → Closed.",
  },
  {
    question: "Can I integrate with Jira or other tools?",
    answer: "Yes! Go to Settings > Integrations to connect BugLens with Jira, Slack, Microsoft Teams, and Azure DevOps.",
  },
];

const shortcuts = [
  { key: "⌘ + K", description: "Open command palette" },
  { key: "⌘ + /", description: "Toggle sidebar" },
  { key: "←  →", description: "Navigate between screenshots" },
  { key: "Esc", description: "Close dialogs and modals" },
];

export default function HelpPage() {
  return (
    <div className="container py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Help & Documentation</h1>
        <p className="text-muted-foreground mt-2">
          Learn how to use BugLens to track bugs and collaborate with your team
        </p>
      </div>

      {/* Features Overview */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Features Overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <feature.icon className="h-4 w-4 text-primary" />
                  </div>
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Keyboard Shortcuts */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Keyboard className="h-5 w-5" />
          Keyboard Shortcuts
        </h2>
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {shortcuts.map((shortcut) => (
                <div key={shortcut.key} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{shortcut.description}</span>
                  <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded">{shortcut.key}</kbd>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* FAQ */}
      <section className="mb-12">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <HelpCircle className="h-5 w-5" />
          Frequently Asked Questions
        </h2>
        <Card>
          <CardContent className="pt-6">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </section>

      {/* Support */}
      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Need More Help?
        </h2>
        <Card>
          <CardHeader>
            <CardTitle>Contact Support</CardTitle>
            <CardDescription>
              Can&apos;t find what you&apos;re looking for? We&apos;re here to help.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <Button variant="outline" asChild>
              <a href="mailto:support@buglens.com">
                Email Support
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="https://github.com/whynaidu/BugLens/issues" target="_blank" rel="noopener noreferrer">
                Report an Issue
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
