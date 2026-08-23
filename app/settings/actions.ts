"use server"

import { createClient } from "@/lib/supabase/server"
import type { ActionState } from "@/lib/types"
import { revalidatePath } from "next/cache"

export async function updateDisplayNameAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const displayName = String(formData.get("displayName") ?? "").trim()
  if (displayName.length < 1) return { error: "Enter a display name." }
  if (displayName.length > 60) return { error: "Keep it under 60 characters." }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Sign in first." }

  const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id)

  if (error) {
    console.log("[v0] update display name failed:", error.message)
    return { error: "Could not update your display name. Try again." }
  }

  revalidatePath("/settings")
  revalidatePath("/clubs")
  return { success: "Display name updated." }
}
