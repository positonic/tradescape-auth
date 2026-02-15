import { NextResponse } from "next/server";
import { decode } from "next-auth/jwt";
import jwt from "jsonwebtoken";
import { db } from "~/server/db";

export async function POST(request: Request) {
  try {
    const sessionToken = request.headers.get("x-session-token");
    if (!sessionToken) {
      return NextResponse.json(
        { error: "Missing x-session-token header" },
        { status: 400 },
      );
    }

    if (!process.env.AUTH_SECRET) {
      return NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 },
      );
    }

    // Decode the encrypted NextAuth JWT session cookie
    const decoded = await decode({
      token: sessionToken,
      secret: process.env.AUTH_SECRET,
    });

    if (!decoded?.sub) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401 },
      );
    }

    // Look up the user in the database
    const user = await db.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, name: true, image: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    // Generate a 7-day JWT for the extension
    const expirySeconds = 60 * 60 * 24 * 7;
    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        picture: user.image,
        tokenType: "extension-token",
      },
      process.env.AUTH_SECRET,
      { algorithm: "HS256", expiresIn: expirySeconds },
    );

    const expiresAt = Date.now() + expirySeconds * 1000;

    return NextResponse.json({ jwt: token, expiresAt });
  } catch (error) {
    console.error("Extension token exchange error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
