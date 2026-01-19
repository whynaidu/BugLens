import { Resend } from "resend";
import { format } from "date-fns";

// Only initialize Resend if API key is provided
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// Helper to check if email is configured
function isEmailConfigured(): boolean {
  return resend !== null;
}

const FROM_EMAIL = process.env.EMAIL_FROM || "BugLens <noreply@buglens.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Common email header component
const emailHeader = `
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #6366f1; margin: 0;">BugLens</h1>
    <p style="color: #666; margin-top: 5px;">Visual Bug Tracking</p>
  </div>
`;

// Common email footer component
const emailFooter = `
  <div style="text-align: center; font-size: 12px; color: #999; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
    <p>This email was sent by BugLens. Manage your notification preferences in your account settings.</p>
  </div>
`;

// Common email wrapper
function wrapEmail(content: string, title: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${emailHeader}
        ${content}
        ${emailFooter}
      </body>
    </html>
  `;
}

interface SendInvitationEmailParams {
  to: string;
  inviterName: string;
  organizationName: string;
  role: string;
  token: string;
}

export async function sendInvitationEmail({
  to,
  inviterName,
  organizationName,
  role,
  token,
}: SendInvitationEmailParams) {
  if (!resend) {
    console.warn("Email not configured - skipping invitation email to:", to);
    return { id: "email-not-configured" };
  }

  const inviteUrl = `${APP_URL}/invite/${token}`;

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `You've been invited to join ${organizationName} on BugLens`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invitation to ${organizationName}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #6366f1; margin: 0;">BugLens</h1>
            <p style="color: #666; margin-top: 5px;">Visual Bug Tracking</p>
          </div>

          <div style="background: #f8fafc; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
            <h2 style="margin-top: 0; color: #1e293b;">You're invited!</h2>
            <p><strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on BugLens as a <strong>${role}</strong>.</p>
            <p>BugLens helps teams capture screenshots, annotate bugs visually, and collaborate in real-time.</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteUrl}" style="background: #6366f1; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 500; display: inline-block;">
                Accept Invitation
              </a>
            </div>

            <p style="font-size: 14px; color: #666;">
              Or copy and paste this link into your browser:<br>
              <a href="${inviteUrl}" style="color: #6366f1; word-break: break-all;">${inviteUrl}</a>
            </p>
          </div>

          <div style="text-align: center; font-size: 12px; color: #999;">
            <p>This invitation will expire in 7 days.</p>
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
          </div>
        </body>
      </html>
    `,
    text: `
You've been invited to join ${organizationName} on BugLens!

${inviterName} has invited you to join ${organizationName} as a ${role}.

Click the link below to accept the invitation:
${inviteUrl}

This invitation will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.
    `,
  });

  if (error) {
    console.error("Failed to send invitation email:", error);
    throw new Error("Failed to send invitation email");
  }

  return data;
}

interface SendWelcomeEmailParams {
  to: string;
  name: string;
}

export async function sendWelcomeEmail({ to, name }: SendWelcomeEmailParams) {
  if (!resend) {
    console.warn("Email not configured - skipping welcome email to:", to);
    return { id: "email-not-configured" };
  }

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: "Welcome to BugLens!",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to BugLens</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #6366f1; margin: 0;">BugLens</h1>
            <p style="color: #666; margin-top: 5px;">Visual Bug Tracking</p>
          </div>

          <div style="background: #f8fafc; border-radius: 8px; padding: 30px;">
            <h2 style="margin-top: 0; color: #1e293b;">Welcome, ${name}!</h2>
            <p>Thank you for joining BugLens. We're excited to help you track and resolve bugs more efficiently.</p>

            <h3 style="color: #1e293b;">Get Started</h3>
            <ul style="padding-left: 20px;">
              <li>Create your first organization</li>
              <li>Set up a project</li>
              <li>Upload screenshots and annotate bugs</li>
              <li>Invite your team members</li>
            </ul>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${APP_URL}/dashboard" style="background: #6366f1; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 500; display: inline-block;">
                Go to Dashboard
              </a>
            </div>
          </div>

          <div style="text-align: center; font-size: 12px; color: #999; margin-top: 20px;">
            <p>Need help? Contact us at support@buglens.com</p>
          </div>
        </body>
      </html>
    `,
    text: `
Welcome to BugLens, ${name}!

Thank you for joining BugLens. We're excited to help you track and resolve bugs more efficiently.

Get Started:
- Create your first organization
- Set up a project
- Upload screenshots and annotate bugs
- Invite your team members

Go to your dashboard: ${APP_URL}/dashboard

Need help? Contact us at support@buglens.com
    `,
  });

  if (error) {
    console.error("Failed to send welcome email:", error);
    // Don't throw - welcome emails are not critical
    return null;
  }

  return data;
}

// ============================================
// NOTIFICATION EMAILS
// ============================================

interface SendBugAssignedEmailParams {
  to: string;
  bugTitle: string;
  bugId: string;
  assignerName: string;
  projectName: string;
  orgSlug: string;
}

export async function sendBugAssignedEmail({
  to,
  bugTitle,
  bugId,
  assignerName,
  projectName,
  orgSlug,
}: SendBugAssignedEmailParams) {
  if (!resend) {
    console.warn("Email not configured - skipping bug assigned email to:", to);
    return { id: "email-not-configured" };
  }

  const bugUrl = `${APP_URL}/${orgSlug}/bugs/${bugId}`;

  const content = `
    <div style="background: #f8fafc; border-radius: 8px; padding: 30px;">
      <h2 style="margin-top: 0; color: #1e293b;">Bug Assigned to You</h2>
      <p><strong>${assignerName}</strong> assigned you a bug in <strong>${projectName}</strong>:</p>

      <div style="background: white; border-radius: 6px; padding: 20px; margin: 20px 0; border-left: 4px solid #6366f1;">
        <h3 style="margin: 0 0 10px 0; color: #1e293b;">${bugTitle}</h3>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${bugUrl}" style="background: #6366f1; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 500; display: inline-block;">
          View Bug
        </a>
      </div>
    </div>
  `;

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `[BugLens] Bug assigned: ${bugTitle}`,
    html: wrapEmail(content, `Bug Assigned: ${bugTitle}`),
    text: `
Bug Assigned to You

${assignerName} assigned you a bug in ${projectName}:

${bugTitle}

View bug: ${bugUrl}
    `.trim(),
  });

  if (error) {
    console.error("Failed to send bug assigned email:", error);
    throw new Error("Failed to send bug assigned email");
  }

  return data;
}

interface SendNewCommentEmailParams {
  to: string;
  bugTitle: string;
  bugId: string;
  commenterName: string;
  commentPreview: string;
  projectName: string;
  orgSlug: string;
}

export async function sendNewCommentEmail({
  to,
  bugTitle,
  bugId,
  commenterName,
  commentPreview,
  projectName,
  orgSlug,
}: SendNewCommentEmailParams) {
  if (!resend) {
    console.warn("Email not configured - skipping new comment email to:", to);
    return { id: "email-not-configured" };
  }

  const bugUrl = `${APP_URL}/${orgSlug}/bugs/${bugId}`;

  const content = `
    <div style="background: #f8fafc; border-radius: 8px; padding: 30px;">
      <h2 style="margin-top: 0; color: #1e293b;">New Comment</h2>
      <p><strong>${commenterName}</strong> commented on a bug in <strong>${projectName}</strong>:</p>

      <div style="background: white; border-radius: 6px; padding: 20px; margin: 20px 0;">
        <h4 style="margin: 0 0 10px 0; color: #666;">On: ${bugTitle}</h4>
        <p style="margin: 0; color: #333; font-style: italic;">"${commentPreview}"</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${bugUrl}" style="background: #6366f1; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 500; display: inline-block;">
          View Comment
        </a>
      </div>
    </div>
  `;

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `[BugLens] New comment on: ${bugTitle}`,
    html: wrapEmail(content, `New Comment on: ${bugTitle}`),
    text: `
New Comment

${commenterName} commented on a bug in ${projectName}:

Bug: ${bugTitle}
Comment: "${commentPreview}"

View comment: ${bugUrl}
    `.trim(),
  });

  if (error) {
    console.error("Failed to send new comment email:", error);
    throw new Error("Failed to send new comment email");
  }

  return data;
}

interface SendStatusChangedEmailParams {
  to: string;
  bugTitle: string;
  bugId: string;
  changerName: string;
  oldStatus: string;
  newStatus: string;
  projectName: string;
  orgSlug: string;
}

export async function sendStatusChangedEmail({
  to,
  bugTitle,
  bugId,
  changerName,
  oldStatus,
  newStatus,
  projectName,
  orgSlug,
}: SendStatusChangedEmailParams) {
  if (!resend) {
    console.warn("Email not configured - skipping status changed email to:", to);
    return { id: "email-not-configured" };
  }

  const bugUrl = `${APP_URL}/${orgSlug}/bugs/${bugId}`;

  const statusColors: Record<string, string> = {
    open: "#ef4444",
    in_progress: "#f59e0b",
    in_review: "#3b82f6",
    resolved: "#10b981",
    closed: "#6b7280",
  };

  const newStatusColor = statusColors[newStatus.toLowerCase()] || "#6366f1";

  const content = `
    <div style="background: #f8fafc; border-radius: 8px; padding: 30px;">
      <h2 style="margin-top: 0; color: #1e293b;">Status Changed</h2>
      <p><strong>${changerName}</strong> updated a bug in <strong>${projectName}</strong>:</p>

      <div style="background: white; border-radius: 6px; padding: 20px; margin: 20px 0;">
        <h4 style="margin: 0 0 15px 0; color: #1e293b;">${bugTitle}</h4>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="background: #f1f5f9; padding: 4px 12px; border-radius: 4px; font-size: 14px;">${oldStatus}</span>
          <span style="color: #666;">→</span>
          <span style="background: ${newStatusColor}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 14px;">${newStatus}</span>
        </div>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${bugUrl}" style="background: #6366f1; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 500; display: inline-block;">
          View Bug
        </a>
      </div>
    </div>
  `;

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `[BugLens] Status changed: ${bugTitle}`,
    html: wrapEmail(content, `Status Changed: ${bugTitle}`),
    text: `
Status Changed

${changerName} updated a bug in ${projectName}:

Bug: ${bugTitle}
Status: ${oldStatus} → ${newStatus}

View bug: ${bugUrl}
    `.trim(),
  });

  if (error) {
    console.error("Failed to send status changed email:", error);
    throw new Error("Failed to send status changed email");
  }

  return data;
}

interface SendDigestEmailParams {
  to: string;
  period: "daily" | "weekly";
  notifications: Array<{
    title: string;
    message: string;
    createdAt: Date;
  }>;
}

export async function sendDigestEmail({
  to,
  period,
  notifications,
}: SendDigestEmailParams) {
  if (!resend) {
    console.warn("Email not configured - skipping digest email to:", to);
    return { id: "email-not-configured" };
  }

  const periodLabel = period === "daily" ? "Daily" : "Weekly";
  const dashboardUrl = `${APP_URL}/dashboard`;

  const notificationItems = notifications
    .map(
      (n) => `
        <div style="background: white; border-radius: 6px; padding: 15px; margin: 10px 0; border-left: 3px solid #6366f1;">
          <h4 style="margin: 0 0 5px 0; color: #1e293b; font-size: 14px;">${n.title}</h4>
          <p style="margin: 0; color: #666; font-size: 13px;">${n.message}</p>
          <span style="font-size: 12px; color: #999;">${format(n.createdAt, "MMM d, h:mm a")}</span>
        </div>
      `
    )
    .join("");

  const content = `
    <div style="background: #f8fafc; border-radius: 8px; padding: 30px;">
      <h2 style="margin-top: 0; color: #1e293b;">${periodLabel} Digest</h2>
      <p>Here's what happened in BugLens over the past ${period === "daily" ? "24 hours" : "week"}:</p>

      <div style="margin: 20px 0;">
        ${notificationItems}
      </div>

      <p style="font-size: 14px; color: #666;">You have ${notifications.length} notification${notifications.length !== 1 ? "s" : ""}.</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${dashboardUrl}" style="background: #6366f1; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 500; display: inline-block;">
          Go to Dashboard
        </a>
      </div>
    </div>
  `;

  const textNotifications = notifications
    .map((n) => `- ${n.title}: ${n.message}`)
    .join("\n");

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `[BugLens] Your ${periodLabel.toLowerCase()} digest`,
    html: wrapEmail(content, `${periodLabel} Digest`),
    text: `
${periodLabel} Digest

Here's what happened in BugLens over the past ${period === "daily" ? "24 hours" : "week"}:

${textNotifications}

You have ${notifications.length} notification${notifications.length !== 1 ? "s" : ""}.

Go to dashboard: ${dashboardUrl}
    `.trim(),
  });

  if (error) {
    console.error("Failed to send digest email:", error);
    throw new Error("Failed to send digest email");
  }

  return data;
}
