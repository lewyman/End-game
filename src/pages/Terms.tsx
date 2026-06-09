export default function Terms() {
  return (
    <div className="min-h-screen bg-background px-4 py-16 text-white">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-4xl font-bold">Terms of Use</h1>
          <p className="mt-2 text-muted-foreground">Last updated May 2026</p>
        </div>
        <section className="space-y-3 text-foreground/80">
          <h2 className="text-xl font-bold text-white">Educational use only</h2>
          <p>Bio-Sync Academy and MAIA are nursing education and study tools. They do not provide medical advice, diagnosis, treatment, prescribing guidance, or patient-specific clinical decisions.</p>
          <p>Always verify medication information, calculations, and clinical decisions with your nursing program, instructor, pharmacist, provider, facility policy, and official references.</p>
        </section>
        <section className="space-y-3 text-foreground/80">
          <h2 className="text-xl font-bold text-white">Subscriptions</h2>
          <p>Free MAIA includes limited daily use. Pro MAIA includes expanded daily use while your subscription is active. Subscription access may be revoked when Stripe reports cancellation, failed payment, or inactive status.</p>
        </section>
        <section className="space-y-3 text-foreground/80">
          <h2 className="text-xl font-bold text-white">AI accuracy</h2>
          <p>AI outputs can be incomplete or incorrect. You are responsible for verifying any educational content before relying on it for exams, clinical preparation, or skills practice.</p>
        </section>
        <section className="space-y-3 text-foreground/80">
          <h2 className="text-xl font-bold text-white">Generated tools</h2>
          <p>AI-generated tools may require admin review before becoming public. Tools are educational simulations and should not be used for real patient care.</p>
        </section>
        <section className="space-y-3 text-foreground/80">
          <h2 className="text-xl font-bold text-white">Contact</h2>
          <p>Questions: contact@endgameenhancements.com</p>
        </section>
      </div>
    </div>
  );
}
