import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { getAuthPrisma } from "@/lib/prisma"
import { compare } from "bcryptjs"

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
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
          return null
        }

        try {
          // Use direct connection for authentication
          const authPrisma = getAuthPrisma()

          const user = await authPrisma.users.findUnique({
          where: {
            email: credentials.email
          },
          include: {
            companies: true
          }
        })

        if (!user) {
          return null
        }

        // For now, we'll implement basic password checking
        // In production, passwords should be hashed
        const isPasswordValid = await compare(credentials.password, user.password || "")

        if (!isPasswordValid) {
          return null
        }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            companyId: user.company_id,
            company: user.companies
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
          id: token.id,
          role: token.role,
          companyId: token.companyId,
          company: token.company
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
          company: u.company
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