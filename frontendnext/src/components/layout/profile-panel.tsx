"use client";

// Top-right avatar + name. Opens a side panel with my details, appearance
// settings and log out.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import { ImageUpload } from "@/components/common/image-upload";
import { PersonAvatar } from "@/components/common/person-avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ROLE_LABELS } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { useAuthStore } from "@/stores/auth-store";
import { useProfileStore } from "@/stores/profile-store";
import { AppearanceSettings } from "./appearance-settings";

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words">{value || "—"}</dd>
    </div>
  );
}

export function ProfileButton() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const company = useAuthStore((s) => s.company);
  const logout = useAuthStore((s) => s.logout);
  const profile = useProfileStore((s) => s.profile);
  const loadProfile = useProfileStore((s) => s.load);
  const setPhoto = useProfileStore((s) => s.setPhoto);
  const [open, setOpen] = useState(false);
  const employeeId = user?.employee_id;

  // Reload whenever the employee record changes (e.g. switched company)
  useEffect(() => {
    if (employeeId) loadProfile();
  }, [employeeId, company?.id, loadProfile]);

  if (!user) return null;
  const mine = employeeId && profile?.id === employeeId ? profile : null;
  const name = mine?.name ?? user.name;

  async function handleLogout() {
    setOpen(false);
    await logout();
    useProfileStore.getState().clear();
    router.replace("/login");
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="lg" className="h-10 gap-2 rounded-full pr-2 pl-1" aria-label={`${name} — profile and settings`}>
          <PersonAvatar name={name} photoUrl={mine?.photoUrl} />
          <span className="hidden max-w-36 flex-col items-start leading-tight md:flex">
            <span className="truncate text-sm font-semibold">{name}</span>
            <span className="truncate text-2xs font-normal text-muted-foreground">{mine?.designation ?? ROLE_LABELS[user.role]}</span>
          </span>
          <ChevronDown className="hidden text-muted-foreground md:block" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-sm">
        <SheetHeader className="items-center border-b pt-8 pb-6 text-center">
          <PersonAvatar name={name} photoUrl={mine?.photoUrl} className="size-20 text-xl [&_[data-slot=avatar-fallback]]:text-2xl" />
          <SheetTitle className="mt-2 text-lg">{name}</SheetTitle>
          <SheetDescription>
            {[mine?.designation, company?.name].filter(Boolean).join(" · ") || user.email}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {mine && (
            <>
              <div className="mb-2 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">Photo</div>
              <ImageUpload kind="employee-photo" label="Change profile photo" value={mine.photoUrl} onChange={(url) => setPhoto(url)} hint="Shown to your team." />
              <Separator className="my-5" />
            </>
          )}

          <div className="mb-1 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">Details</div>
          <dl className="divide-y">
            <Detail label="Email" value={user.email} />
            <Detail label="Role" value={ROLE_LABELS[user.role]} />
            {mine && (
              <>
                <Detail label="Employee code" value={mine.code} />
                <Detail label="Designation" value={mine.designation} />
                <Detail label="Department" value={mine.department} />
                <Detail label="Reports to" value={mine.manager?.name} />
                <Detail label="Joined" value={mine.joinDate ? fmtDate(mine.joinDate) : null} />
              </>
            )}
          </dl>

          <Separator className="my-5" />
          <AppearanceSettings />
        </div>

        <SheetFooter className="border-t p-4">
          <Button variant="outline" size="lg" onClick={handleLogout} className="w-full hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive">
            <LogOut /> Log out
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
