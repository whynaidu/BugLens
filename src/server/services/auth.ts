import bcrypt from "bcryptjs";
import { db } from "../db";
import type { SignupInput } from "@/lib/validations/auth";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export async function getUserByEmail(email: string) {
  return db.user.findUnique({
    where: { email: email.toLowerCase() },
  });
}

export async function getUserById(id: string) {
  return db.user.findUnique({
    where: { id },
  });
}

export async function createUser(data: Omit<SignupInput, "confirmPassword">) {
  const { name, email, password } = data;

  const existingUser = await getUserByEmail(email);

  if (existingUser) {
    throw new Error("User with this email already exists");
  }

  const hashedPassword = await hashPassword(password);

  const user = await db.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      hashedPassword,
    },
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

export async function updateUserPassword(userId: string, newPassword: string) {
  const hashedPassword = await hashPassword(newPassword);

  return db.user.update({
    where: { id: userId },
    data: { hashedPassword },
  });
}

export async function verifyEmail(userId: string) {
  return db.user.update({
    where: { id: userId },
    data: { emailVerified: new Date() },
  });
}

export async function createVerificationToken(email: string) {
  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Delete existing token for this email
  await db.verificationToken.deleteMany({
    where: { identifier: email },
  });

  // Create new token
  await db.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires,
    },
  });

  return token;
}

export async function validateVerificationToken(token: string) {
  const verificationToken = await db.verificationToken.findUnique({
    where: { token },
  });

  if (!verificationToken) {
    return null;
  }

  if (verificationToken.expires < new Date()) {
    // Token expired, delete it
    await db.verificationToken.delete({
      where: { token },
    });
    return null;
  }

  return verificationToken;
}

export async function deleteVerificationToken(token: string) {
  return db.verificationToken.delete({
    where: { token },
  });
}

export async function createPasswordResetToken(email: string) {
  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Delete existing reset token for this email
  await db.verificationToken.deleteMany({
    where: { identifier: `reset:${email}` },
  });

  // Create new reset token
  await db.verificationToken.create({
    data: {
      identifier: `reset:${email}`,
      token,
      expires,
    },
  });

  return token;
}

export async function validatePasswordResetToken(token: string) {
  const resetToken = await db.verificationToken.findUnique({
    where: { token },
  });

  if (!resetToken) {
    return null;
  }

  if (!resetToken.identifier.startsWith("reset:")) {
    return null;
  }

  if (resetToken.expires < new Date()) {
    // Token expired, delete it
    await db.verificationToken.delete({
      where: { token },
    });
    return null;
  }

  const email = resetToken.identifier.replace("reset:", "");
  return { email, token: resetToken };
}
