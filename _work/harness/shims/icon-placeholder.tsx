// OFFLINE SHIM - documented in GAPS.md.
//
// Upstream's real IconPlaceholder lives in the shadcn *website* app
// (apps/v4/app/(app)/(create)/components/icon-placeholder.tsx), NOT in the registry.
// 1,856 references to it appear inside shipped sidebar-* blocks, so those blocks
// cannot compile from registry files alone - an upstream packaging gap, not ours.
//
// The real component switches between five icon libraries (lucide, tabler,
// hugeicons, phosphor, remixicon) based on a nuqs search-param provider that
// requires a Next.js router. Reproducing that would pull in four extra icon
// packages and a router purely to render placeholders.
//
// This shim keeps the exact prop contract and mirrors upstream's own Suspense
// fallback (SquareIcon), so blocks render faithfully offline. It resolves the
// `lucide` key when present, matching the default icon library.
import { SquareIcon } from "lucide-react"

type Props = { [k: string]: string | undefined } & React.ComponentProps<"svg">

export function IconPlaceholder({ lucide, tabler, hugeicons, phosphor, remixicon, ...props }: Props) {
  // Upstream returns null when the active library has no icon name mapped.
  if (!lucide && !tabler && !hugeicons && !phosphor && !remixicon) return null
  return <SquareIcon {...(props as React.ComponentProps<"svg">)} />
}

export default IconPlaceholder
