"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Megaphone, Plus, Trash2, X } from "lucide-react";
import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { timeAgo } from "@/lib/format";
import { announcementSchema, type AnnouncementInput } from "@/lib/schemas/announcement";
import { isUserActive } from "@/lib/session/activity";
import { useCan } from "@/stores/auth-store";
import { useFeedStore } from "@/stores/feed-store";

// Announcements box. Also keeps the feed (announcements + birthdays) fresh,
// which the birthday panel reads too.
export function AnnouncementsPanel() {
  const can = useCan();
  const announcements = useFeedStore((s) => s.announcements);
  const load = useFeedStore((s) => s.load);
  const post = useFeedStore((s) => s.post);
  const remove = useFeedStore((s) => s.remove);
  const [composing, setComposing] = useState(false);
  const form = useForm<AnnouncementInput>({ resolver: zodResolver(announcementSchema), defaultValues: { title: "", message: "" } });

  useEffect(() => {
    load();
    // Every 2 min, only while the user is active (an idle tab must not keep the session alive)
    const t = setInterval(() => {
      if (isUserActive(5 * 60000)) load();
    }, 120000);
    return () => clearInterval(t);
  }, [load]);

  async function onSubmit(values: AnnouncementInput) {
    if (!(await post(values))) return;
    form.reset();
    setComposing(false);
  }

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Megaphone className="size-4" /> Announcements
        </CardTitle>
        {can("announcements.manage") && !composing && (
          <CardAction>
            <Button variant="ghost" size="sm" onClick={() => setComposing(true)}>
              <Plus /> Post
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {composing && (
          <form onSubmit={form.handleSubmit(onSubmit)} className="mb-3 flex flex-col gap-2 rounded-lg bg-muted p-3" noValidate>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">New announcement</span>
              <Button type="button" variant="ghost" size="icon-xs" onClick={() => setComposing(false)} aria-label="Cancel">
                <X />
              </Button>
            </div>
            <FormField label="Title" htmlFor="ann-title" error={form.formState.errors.title}>
              <Input id="ann-title" maxLength={200} {...form.register("title")} />
            </FormField>
            <FormField label="Details" htmlFor="ann-message">
              <Textarea id="ann-message" rows={3} placeholder="Optional" {...form.register("message")} />
            </FormField>
            <Button type="submit" size="sm" disabled={form.formState.isSubmitting}>
              Publish
            </Button>
          </form>
        )}
        <ScrollArea className="h-44">
          {announcements.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No announcements yet.</p>
          ) : (
            <div className="flex flex-col gap-2 pr-3">
              {announcements.map((a) => (
                <div key={a.id} className="rounded-lg border px-3 py-2">
                  <div className="flex justify-between gap-2">
                    <div className="text-sm font-medium">{a.title}</div>
                    {a.canDelete && (
                      <Button variant="ghost" size="icon-xs" onClick={() => remove(a.id)} aria-label="Delete announcement" className="hover:text-destructive">
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                  {a.message && <p className="mt-0.5 text-xs whitespace-pre-line text-muted-foreground">{a.message}</p>}
                  <div className="mt-1 text-2xs text-muted-foreground">
                    {a.created_by_name || "You"} · {timeAgo(a.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
