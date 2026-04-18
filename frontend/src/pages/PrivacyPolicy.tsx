export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen pt-16 bg-background py-12">
      {/* Logo - Upper Left (3 inches = 288px) */}
      <div className="absolute top-4 left-4 z-10">
        <img 
          src="/images/Bio_Logo_white-87f86ab6b807.png" 
          alt="Bio-Sync Academy Logo" 
          className="w-[288px] h-[288px] object-contain"
        />
      </div>

      <div className="container mx-auto max-w-3xl px-4">
        <h1 className="mb-6 text-4xl font-bold">Privacy Policy</h1>
        <p className="mb-8 text-muted-foreground">
          Last updated: March 7, 2026
        </p>

        <section className="mb-8">
          <h2 className="mb-3 text-2xl font-semibold">1. Introduction</h2>
          <p className="text-muted-foreground">
            Tech at the Bedside ("we," "us," or "our") is committed to protecting your privacy. 
            This Privacy Policy explains how we collect, use, and safeguard your personal information 
            when you visit our website and subscribe to our newsletter.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-2xl font-semibold">2. Information We Collect</h2>
          <p className="mb-3 text-muted-foreground">We collect the following information:</p>
          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li><strong>Email address:</strong> When you subscribe to our newsletter</li>
            <li><strong>Usage data:</strong> Pages visited, time spent on site (via analytics)</li>
            <li><strong>Device information:</strong> Browser type, operating system, IP address</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-2xl font-semibold">3. How We Use Your Information</h2>
          <p className="mb-3 text-muted-foreground">We use your information to:</p>
          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>Send weekly newsletters with nursing tech tips and app reviews</li>
            <li>Improve our content and website experience</li>
            <li>Respond to your questions or feedback</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-2xl font-semibold">4. Newsletter & Email</h2>
          <p className="text-muted-foreground">
            When you subscribe to our newsletter, we store your email address to send you weekly updates. 
            You can unsubscribe at any time by clicking the "Unsubscribe" link at the bottom of any email. 
            We use email service providers to deliver our newsletters, and they have access to your email 
            address solely for delivery purposes.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-2xl font-semibold">5. Cookies & Analytics</h2>
          <p className="text-muted-foreground">
            We may use cookies and similar tracking technologies to analyze website traffic and 
            understand how visitors interact with our content. This helps us improve our articles 
            and user experience. You can disable cookies in your browser settings.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-2xl font-semibold">6. Data Security</h2>
          <p className="text-muted-foreground">
            We take reasonable measures to protect your personal information from unauthorized access, 
            alteration, or disclosure. However, no internet transmission is completely secure, and 
            we cannot guarantee absolute security.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-2xl font-semibold">7. Third-Party Links</h2>
          <p className="text-muted-foreground">
            Our website may contain links to third-party websites (such as app stores or affiliate partners). 
            We are not responsible for the privacy practices of these external sites. We encourage you 
            to read their privacy policies before providing any personal information.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-2xl font-semibold">8. Affiliate Disclosure</h2>
          <p className="text-muted-foreground">
            Tech at the Bedside participates in affiliate marketing programs. When you click on an 
            affiliate link and make a purchase, we may receive a commission at no additional cost to you. 
            We only recommend products we genuinely believe will help nursing students.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-2xl font-semibold">9. Your Rights</h2>
          <p className="mb-3 text-muted-foreground">You have the right to:</p>
          <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
            <li>Access the personal information we hold about you</li>
            <li>Request correction of inaccurate information</li>
            <li>Request deletion of your personal information</li>
            <li>Unsubscribe from our newsletter at any time</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-2xl font-semibold">10. Children's Privacy</h2>
          <p className="text-muted-foreground">
            Our website is intended for nursing students and healthcare professionals. We do not knowingly 
            collect personal information from children under 13. If you believe we have collected information 
            from a child under 13, please contact us immediately.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-2xl font-semibold">11. Changes to This Policy</h2>
          <p className="text-muted-foreground">
            We may update this Privacy Policy from time to time. Changes will be posted on this page 
            with an updated "Last updated" date. We encourage you to review this policy periodically.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-2xl font-semibold">12. Contact Us</h2>
          <p className="text-muted-foreground">
            If you have questions about this Privacy Policy or want to exercise your privacy rights, 
            please contact us at:{" "}
            <a 
              href="mailto:christian.c.lewis@endgameenhancements.com" 
              className="text-primary hover:underline"
            >
              christian.c.lewis@endgameenhancements.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
