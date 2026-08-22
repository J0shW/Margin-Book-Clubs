"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export type AuthState = { error?: string } | null

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
