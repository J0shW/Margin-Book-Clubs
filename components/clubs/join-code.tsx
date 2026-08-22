"use client"

import { useState } from "react"
import { CheckIcon, CopyIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

export function JoinCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard can be blocked; the code is visible on screen either way.
    }
  }

  return (
    <div className="flex items-center gap-1">
      <span className="font-mono text-sm tracking-[0.3em] text-muted-foreground">{code}</span>
      <Button variant="ghost" size="icon-sm" onClick={copy} aria-label="Copy join code">
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  )
}
