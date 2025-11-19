import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { getAuthPrisma } from "@/lib/prisma"
import { compare } from "bcryptjs"

// Detect if we're running on Vercel/production
const isProduction = process.env.NEXTAUTH_URL?.startsWith("https://") ?? false;

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  cookies: {
    sessionToken: {
      name: isProduction
        ? `__Secure-next-auth.session-token`
        : `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction,
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log('🔴 Auth: Missing email or password')
          return null
        }

        try {
          // Use direct connection for authentication
          const authPrisma = getAuthPrisma()

          console.log(`🔍 Auth: Looking up user: ${credentials.email}`)
          const user = await authPrisma.user.findUnique({
            where: {
              email: credentials.email
            },
            include: {
              company: true
            }
          })

        if (!user) {
          console.log('🔴 Auth: User not found')
          return null
        }

        console.log(`✅ Auth: User found: ${user.email} (ID: ${user.id})`)
        console.log(`🔑 Auth: Has password hash: ${!!user.password}, Length: ${user.password?.length || 0}`)

        // For now, we'll implement basic password checking
        // In production, passwords should be hashed
        const isPasswordValid = await compare(credentials.password, user.password || "")

        console.log(`🔐 Auth: Password valid: ${isPasswordValid}`)

        if (!isPasswordValid) {
          console.log('🔴 Auth: Password comparison failed')
          return null
        }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            companyId: user.companyId,
            company: user.company
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      }
    })
  ],
  callbacks: {
    session: ({ session, token }) => {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id as string,
          role: token.role as string,
          companyId: token.companyId as string,
        },
      }
    },
    jwt: ({ token, user }) => {
      if (user) {
        const u = user as any
        return {
          ...token,
          id: u.id,
          role: u.role,
          companyId: u.companyId,
          // Don't store company object - it causes JWT size/serialization issues
        }
      }
      return token
    },
  },
  pages: {
    signIn: "/en/auth/signin",
    signUp: "/en/auth/signup"
  }
}