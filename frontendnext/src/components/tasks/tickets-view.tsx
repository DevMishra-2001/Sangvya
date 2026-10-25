"use client";

import { PageHeader } from "@/components/common/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCan } from "@/stores/auth-store";
import { MyTickets } from "./my-tickets";
import { TeamTickets } from "./team-tickets";

// Tickets assigned to me, and — for managers / HR — tickets I assign to others
export function TicketsView() {
  const canAssign = useCan()("tasks.assign");
  return (
    <div>
      <PageHeader title="Tickets" />
      {canAssign ? (
        <Tabs defaultValue="mine">
          <TabsList className="mb-4">
            <TabsTrigger value="mine">My tickets</TabsTrigger>
            <TabsTrigger value="team">Team tickets</TabsTrigger>
          </TabsList>
          <TabsContent value="mine">
            <MyTickets />
          </TabsContent>
          <TabsContent value="team">
            <TeamTickets />
          </TabsContent>
        </Tabs>
      ) : (
        <MyTickets />
      )}
    </div>
  );
}
