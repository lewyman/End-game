export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-background px-4 py-16 text-white">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-4xl font-bold">Refund Policy</h1>
          <p className="mt-2 text-muted-foreground">Last updated May 2026</p>
        </div>
        <section className="space-y-3 text-foreground/80">
          <h2 className="text-xl font-bold text-white">Subscriptions</h2>
          <p>You can cancel a Pro MAIA subscription at any time. Your access continues through the end of the paid billing period unless Stripe or Bio-Sync Academy indicates otherwise.</p>
        </section>
        <section className="space-y-3 text-foreground/80">
          <h2 className="text-xl font-bold text-white">Refund requests</h2>
          <p>If you believe you were charged in error or cannot access the service after payment, email contact@endgameenhancements.com with your account email and Stripe receipt. Refunds are reviewed case by case.</p>
        </section>
        <section className="space-y-3 text-foreground/80">
          <h2 className="text-xl font-bold text-white">Educational disclaimer</h2>
          <p>Because Bio-Sync Academy is an educational software service and AI output can vary, refunds are not guaranteed for disagreement with AI-generated content. Report incorrect content so it can be reviewed.</p>
        </section>
      </div>
    </div>
  );
}
