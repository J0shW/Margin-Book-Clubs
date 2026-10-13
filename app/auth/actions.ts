"use server"

import { createClient } from "@/lib/supabase/server"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

export type AuthState = { error?: string; success?: string } | null

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()
  const password = String(formData.get("password") ?? "")
  return { email, password }
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readCredentials(formData)

  if (!email || !password) {
    return { error: "Enter your email and password." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Log the detail server-side; return copy that does not confirm whether the account exists.
    console.log("[v0] sign-in failed:", error.code, error.message)

    if (error.code === "email_not_confirmed") {
      return { error: "Confirm your email address first — check your inbox for the link." }
    }
    if (error.status === 429) {
      return { error: "Too many attempts. Wait a moment and try again." }
    }
    if (error.code === "invalid_credentials") {
      return { error: "Invalid email or password." }
    }
    return { error: "Something went wrong signing in. Try again." }
  }

  redirect("/clubs")
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readCredentials(formData)
  const displayName = String(formData.get("displayName") ?? "").trim()

  if (!email || !password) {
    return { error: "Enter your email and password." }
  }
  if (password.length < 8) {
    return { error: "Use a password of at least 8 characters." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL,
      data: { display_name: displayName || email.split("@")[0] },
    },
  })

  if (error) {
    console.log("[v0] sign-up failed:", error.code, error.message)

    if (error.code === "weak_password") {
      return { error: "That password is too weak. Try something longer." }
    }
    if (error.code === "email_address_invalid") {
      return { error: "That email address isn’t accepted. Use a real inbox you control." }
    }
    if (error.status === 429) {
      return { error: "Too many attempts. Wait a moment and try again." }
    }
    return { error: "Something went wrong creating your account. Try again." }
  }

  redirect("/auth/sign-up-success")
}

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/auth/login")
}

/** This site's origin, for links in emails. Supabase only sends links to allowed redirect URLs. */
async function siteOrigin(): Promise<string> {
  const headerList = await headers()
  const origin = headerList.get("origin")
  if (origin) return origin
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host")
  const proto = headerList.get("x-forwarded-proto") ?? "https"
  return `${proto}://${host}`
}

export async function requestPasswordResetAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email } = readCredentials(formData)
  if (!email) return { error: "Enter your email address." }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/auth/reset-password`,
  })

  if (error) {
    console.error("password reset request failed:", error.code, error.message)
    if (error.status === 429) {
      return { error: "Too many requests. Wait a few minutes and try again." }
    }
    // Other errors aren't specific to the address, so they don't reveal
    // whether an account exists.
    return { error: "Something went wrong sending the email. Try again." }
  }

  // The same message whether or not the address has an account.
  return { success: `If ${email} has a Margin account, a link to reset your password is on its way.` }
}

export async function updatePasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get("password") ?? "")
  const confirm = String(formData.get("confirm") ?? "")

  if (password.length < 8) return { error: "Use a password of at least 8 characters." }
  if (password !== confirm) return { error: "The two passwords don’t match." }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Your reset link has expired. Request a new one." }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    console.error("password update failed:", error.code, error.message)
    if (error.code === "same_password") {
      return { error: "That’s your current password. Choose a different one." }
    }
    if (error.code === "weak_password") {
      return { error: "That password is too weak. Try something longer." }
    }
    if (error.status === 429) {
      return { error: "Too many attempts. Wait a moment and try again." }
    }
    return { error: "Something went wrong saving your password. Try again." }
  }

  return { success: "Your password has been updated." }
}
