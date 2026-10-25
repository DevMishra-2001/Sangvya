// A person's photo, or their initials when there isn't one
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

export function PersonAvatar({ name, photoUrl, className }: { name: string; photoUrl?: string | null; className?: string }) {
  return (
    <Avatar className={cn("size-8", className)}>
      {photoUrl && <AvatarImage src={`${photoUrl}?tr=w-160,h-160,fo-face`} alt={name} className="object-cover" />}
      <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
