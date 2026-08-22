import { cn } from "@/lib/utils"

type Props = {
  src: string | null
  title: string
  className?: string
}

export function BookCover({ src, title, className }: Props) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-sm border border-border bg-secondary",
        "aspect-[2/3] w-12",
        className,
      )}
    >
      {src ? (
        // Google Books thumbnails are arbitrary remote URLs, so use a plain img
        // instead of next/image to avoid per-host remotePatterns config.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src || "/placeholder.svg"} alt={`Cover of ${title}`} className="size-full object-cover" loading="lazy" />
      ) : (
        <div className="flex size-full items-center justify-center p-1">
          <span className="font-serif text-[0.6rem] leading-tight text-muted-foreground line-clamp-3 text-center">
            {title}
          </span>
        </div>
      )}
    </div>
  )
}
