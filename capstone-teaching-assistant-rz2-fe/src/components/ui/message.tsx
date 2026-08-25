import * as React from "react"
import { cn } from "@/lib/utils"

export function Message({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex w-full", className)} {...props} />
}

export function MessageBubble({
  className,
  isUser,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { isUser?: boolean }) {
  return (
    <div
      className={cn(
        "max-w-[78%] rounded-lg border px-4 py-3 text-sm shadow-sm",
        isUser ? "ml-auto bg-primary text-primary-foreground" : "mx-auto bg-muted",
        className,
      )}
      {...props}
    />
  )
}
