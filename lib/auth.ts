
import NextAuth, { type AuthOptions, type SessionStrategy } from "next-auth";
import type { DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      systemRole: string;
      userId: string;
      role: string;
      email: string;
    } & DefaultSession["user"];
  }

  interface User {
    systemRole: string;
    userId: string;
    role: string;
    email: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    systemRole: string;
    userId: string;
    role: string;
    email: string;
  }
}

const prisma = new PrismaClient();

// For NextAuth v4
export const authOptions: AuthOptions = {
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log("=== Authorize function called ===");
        console.log("Credentials email:", credentials?.email);
        // console.log("TEST_EMAIL env var:", process.env.TEST_EMAIL ? "exists" : "missing");
        // console.log("TEST_PASSWORD env var:", process.env.TEST_PASSWORD ? "exists" : "missing");
        
        if (!credentials?.email || !credentials?.password) {
          console.log("Missing email or password");
          return null;
        }

        // Check if it's the admin account first
        if (
          process.env.ADMIN_EMAIL &&
          process.env.ADMIN_PASSWORD &&
          credentials.email === process.env.ADMIN_EMAIL &&
          credentials.password === process.env.ADMIN_PASSWORD
        ) {
          console.log("Admin account login successful!");
          // Return admin user (no database needed)
          return {
            id: "admin-123",
            userId: "admin-123",
            email: process.env.ADMIN_EMAIL,
            name: "IT Admin",
            role: "IT_ADMIN",
            systemRole: "IT_ADMIN",
          };
        }

        // Check database for other users
        try {
          // Find user in database
          const user = await prisma.users.findUnique({
            where: { email: credentials.email as string },
          });

          if (!user || !user.password) {
            console.log("User not found or missing password");
            return null;
          }

          // Check if user is soft-deleted (deletedAt is not null)
          if (user.deletedAt) {
            console.log("User has been soft-deleted, login denied");
            return null;
          }

          // Check if user is unregistered
          if (user.status === "UNREGISTERED") {
            console.log("User is unregistered, login denied");
            return null;
          }

          // Check password
          const passwordMatch = await bcrypt.compare(
            credentials.password as string,
            user.password
          );

          if (!passwordMatch) {
            console.log("Password mismatch");
            return null;
          }

          console.log("Database user login successful!");
          // Return user object without password
          return {
            id: user.user_id,
            userId: user.user_id,
            email: user.email,
            name: user.name,
            role: user.role,
            systemRole: user.systemRole,
          };
        } catch (dbError) {
          console.error("Database error during login:", dbError);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.systemRole = user.systemRole; 
        token.userId = user.userId;
        token.role = user.role;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.systemRole = token.systemRole;
        session.user.userId = token.userId;
        session.user.role = token.role;
        session.user.email = token.email;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
  },
  session: {
    strategy: "jwt" as SessionStrategy,
  },
  secret: process.env.NEXTAUTH_SECRET,
};


