import { NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import {
  getUserByEmail,
  createPasswordResetToken,
} from "@/server/services/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const validatedFields = forgotPasswordSchema.safeParse(body);

    if (!validatedFields.success) {
      return NextResponse.json(
        { error: "Invalid input" },
        { status: 400 }
      );
    }

    const { email } = validatedFields.data;

    // Check if user exists
    const user = await getUserByEmail(email);

    if (!user) {
      // Don't reveal if user exists - return success anyway
      return NextResponse.json(
        { message: "If an account exists, a password reset email will be sent." },
        { status: 200 }
      );
    }

    // Create password reset token
    const token = await createPasswordResetToken(email);

    // In production, send email with reset link
    // For now, just log the token (remove in production)
    console.log(`Password reset token for ${email}: ${token}`);

    // TODO: Send email using Resend
    // await sendPasswordResetEmail(email, token);

    return NextResponse.json(
      { message: "If an account exists, a password reset email will be sent." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
