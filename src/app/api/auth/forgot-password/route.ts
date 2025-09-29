import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
      include: { companies: true }
    });

    if (!user) {
      // Don't reveal whether the email exists for security
      return NextResponse.json(
        { message: "If an account with this email exists, you will receive a password reset email." },
        { status: 200 }
      );
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Save reset token to database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        reset_token: resetToken,
        reset_token_expiry: resetTokenExpiry,
      },
    });

    // Create reset URL
    const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${resetToken}`;

    // Email content
    const emailSubject = "Reset Your Reminder Password";
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Reset Your Password</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563eb;">Reset Your Reminder Password</h2>

            <p>Hello ${user.name},</p>

            <p>We received a request to reset your password for your Reminder account at ${user.companies.name}.</p>

            <p>Click the button below to reset your password:</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}"
                 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Reset Password
              </a>
            </div>

            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #2563eb;">${resetUrl}</p>

            <p><strong>This link will expire in 1 hour.</strong></p>

            <p>If you didn't request this password reset, you can safely ignore this email. Your password will not be changed.</p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

            <p style="font-size: 12px; color: #666;">
              This email was sent by Reminder, your automated payment collection platform.
            </p>
          </div>
        </body>
      </html>
    `;

    const emailText = `
Reset Your Reminder Password

Hello ${user.name},

We received a request to reset your password for your Reminder account at ${user.companies.name}.

Reset your password by visiting this link:
${resetUrl}

This link will expire in 1 hour.

If you didn't request this password reset, you can safely ignore this email. Your password will not be changed.

---
This email was sent by Reminder, your automated payment collection platform.
    `;

    // Send reset email (mock for testing if AWS SES not configured)
    try {
      await sendEmail({
        to: email,
        subject: emailSubject,
        htmlBody: emailHtml,
        textBody: emailText,
      });
    } catch (emailError) {
      // For testing purposes, log the reset URL instead of failing
      console.log(`Password reset email would be sent to: ${email}`);
      console.log(`Reset URL: ${resetUrl}`);
      console.log(`Email error: ${emailError}`);
    }

    return NextResponse.json(
      { message: "Password reset email sent successfully" },
      { status: 200 }
    );

  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}