"use client";

import { Cake } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuthStore } from "@/stores/auth-store";
import { useFeedStore } from "@/stores/feed-store";

// Today's birthday wishes (the feed is loaded by the announcements panel)
export function BirthdayPanel() {
  const birthdays = useFeedStore((s) => s.birthdays);
  const myEmployeeId = useAuthStore((s) => s.user?.employee_id);

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Cake className="size-4" /> Birthday wishes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {birthdays.length === 0 ? (
          <div className="flex h-44 flex-col items-center justify-center text-center">
            <div className="text-2xl opacity-40" aria-hidden>
              🎂
            </div>
            <p className="mt-1 text-xs text-muted-foreground">No birthdays today.</p>
          </div>
        ) : (
          <ScrollArea className="h-44">
            <div className="flex flex-col gap-2 pr-3">
              {birthdays.map((b) => {
                const mine = b.employeeId === myEmployeeId;
                return (
                  <div key={b.employeeId} className="flex items-center gap-2.5 rounded-lg bg-warning/10 px-3 py-2">
                    <div className="text-xl" aria-hidden>
                      🎂
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{mine ? "Happy birthday to you! 🎉" : `Happy birthday, ${b.name}! 🎉`}</div>
                      {!mine && b.designation && <div className="truncate text-xs text-muted-foreground">{b.designation}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
