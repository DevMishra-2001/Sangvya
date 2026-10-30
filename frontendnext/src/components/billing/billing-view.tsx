"use client";

import { useEffect } from "react";
import Script from "next/script";
import { CreditCard, ExternalLink, Receipt } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate, inr } from "@/lib/format";
import { useCan } from "@/stores/auth-store";
import { useBillingStore } from "@/stores/billing-store";

function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function BillingView() {
  const canManage = useCan()("billing.manage");
  const status = useBillingStore((s) => s.status);
  const invoices = useBillingStore((s) => s.invoices);
  const load = useBillingStore((s) => s.load);
  const subscribe = useBillingStore((s) => s.subscribe);
  const cancel = useBillingStore((s) => s.cancel);

  useEffect(() => {
    load();
  }, [load]);

  if (!status) {
    return (
      <div>
        <PageHeader title="Billing" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  const { subscription, employeeCount, pricePerEmployee, monthlyAmount, trialDaysLeft, isTrialExpired } = status;
  const isTrial = subscription.status === "trial";
  const isActive = subscription.status === "active";
  const isPastDue = subscription.status === "past_due";

  return (
    <div className="flex flex-col gap-6">
      {/* Razorpay Checkout opens from here when subscribing */}
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <PageHeader title="Billing" className="mb-0" />

      <Card>
        <CardHeader>
          <CardDescription>Current plan</CardDescription>
          <CardTitle className="text-2xl">{inr(pricePerEmployee)} / employee / month</CardTitle>
          <CardAction>
            <StatusBadge status={subscription.status} />
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Figure label="Employees billed" value={employeeCount} />
            <Figure label="Monthly amount" value={inr(monthlyAmount)} />
            <Figure
              label={isTrial ? "Trial ends in" : "Renews"}
              value={isTrial ? (isTrialExpired ? "Expired" : `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"}`) : fmtDate(subscription.current_period_end)}
            />
          </div>
          {isTrial && (
            <p className="text-sm text-muted-foreground">
              {isTrialExpired
                ? "Your free trial has ended. Subscribe to keep using Workkind without interruption."
                : `You're on a free trial. Billing is ${inr(pricePerEmployee)} per employee per month, and adjusts automatically as you add or remove employees.`}
            </p>
          )}
          {isPastDue && (
            <Alert variant="destructive">
              <AlertDescription>Your last payment didn&apos;t go through. Please update your payment method to avoid losing access.</AlertDescription>
            </Alert>
          )}
        </CardContent>
        {canManage && (isTrial || isPastDue || isActive) && (
          <CardFooter>
            {(isTrial || isPastDue) && (
              <Button onClick={subscribe}>
                <CreditCard /> {isPastDue ? "Retry payment" : "Subscribe now"}
              </Button>
            )}
            {isActive && (
              <Button variant="outline" onClick={cancel}>
                Cancel subscription
              </Button>
            )}
          </CardFooter>
        )}
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Billing history</h2>
        {invoices.length === 0 ? (
          <EmptyState icon={Receipt} title="No invoices yet" />
        ) : (
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{fmtDate(inv.created_at)}</TableCell>
                    <TableCell>{inv.employee_count}</TableCell>
                    <TableCell className="text-right tabular-nums">{inr(inv.amount)}</TableCell>
                    <TableCell>
                      <StatusBadge status={inv.status} />
                    </TableCell>
                    <TableCell>
                      {inv.razorpay_invoice_id && (
                        <Button variant="ghost" size="icon-sm" asChild>
                          <a href={`https://dashboard.razorpay.com/app/invoices/${inv.razorpay_invoice_id}`} target="_blank" rel="noreferrer" aria-label="Open invoice in Razorpay">
                            <ExternalLink />
                          </a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
