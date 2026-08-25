import * as React from "react"
import { cn } from "@/lib/utils"

export function MessageScroller({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" })
  }, [props.children])

  return <div ref={ref} className={cn("overflow-y-auto", className)} {...props} />
}
