import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const CONTENT: Record<string, { title: string; sections: { heading: string; body: string }[] }> = {
  privacy: {
    title: 'Privacy Policy',
    sections: [
      { heading: 'Information We Collect', body: 'We collect information you provide when creating an account or requesting access, including your name, email address, and date of birth for age verification purposes. We also collect usage data to improve platform functionality.' },
      { heading: 'How We Use Your Information', body: 'Your information is used to operate and improve the platform, verify your age and identity, process payments, and send platform notifications. We do not sell your personal data to third parties.' },
      { heading: 'Data Retention', body: 'We retain your account data for as long as your account is active. Upon account deletion, personal data is removed within 30 days except where retention is required by law.' },
      { heading: 'Your Rights', body: 'You have the right to access, correct, or delete your personal data. To exercise these rights, contact us at privacy@archangelsclub.com.' },
      { heading: 'Cookies', body: 'We use essential cookies to maintain your session. We do not use third-party advertising cookies.' },
      { heading: 'Contact', body: 'For privacy-related inquiries, email privacy@archangelsclub.com.' },
    ],
  },
  terms: {
    title: 'Terms of Service',
    sections: [
      { heading: 'Eligibility', body: 'You must be at least 18 years of age to use this platform. By accessing Archangels Club, you confirm that you are 18 or older and legally permitted to access adult content in your jurisdiction.' },
      { heading: 'Account Approval', body: 'Access to Archangels Club is not automatic. All access requests are manually reviewed. We reserve the right to deny or revoke access at any time without explanation.' },
      { heading: 'Prohibited Conduct', body: 'You may not share, redistribute, or reproduce any content from this platform. You may not attempt to circumvent access controls or share your account credentials with others.' },
      { heading: 'Content Policy', body: 'All content must comply with our content guidelines. Content depicting minors in any sexual context is strictly prohibited and will be reported to law enforcement.' },
      { heading: 'Payments', body: 'All sales are final unless otherwise stated. Platform fees are non-refundable. Creators receive payouts subject to platform fee deductions.' },
      { heading: 'Termination', body: 'We reserve the right to terminate any account found to be in violation of these terms, at our sole discretion.' },
    ],
  },
  compliance: {
    title: 'Compliance',
    sections: [
      { heading: 'Age Verification', body: 'Archangels Club requires all users to be 18 years of age or older. We verify age at registration and require creator compliance with all applicable regulations.' },
      { heading: 'Creator Verification', body: 'All creators are required to submit identity and age verification before publishing content. Documentation is retained in accordance with 18 U.S.C. § 2257.' },
      { heading: '18 U.S.C. § 2257', body: 'All performers depicted in visual content on this platform were at least 18 years of age at the time of production. Records are maintained by the content producer. Custodian of records information is available upon request.' },
      { heading: 'GDPR & CCPA', body: 'We comply with applicable data protection regulations including GDPR and CCPA. Users in applicable regions may request access, correction, or deletion of their data.' },
      { heading: 'Reporting', body: 'To report suspected non-compliant content, use the in-platform report function or email compliance@archangelsclub.com.' },
    ],
  },
  dmca: {
    title: 'DMCA Policy',
    sections: [
      { heading: 'Copyright Policy', body: 'Archangels Club respects intellectual property rights and expects users to do the same. We respond to notices of alleged copyright infringement that comply with the Digital Millennium Copyright Act (DMCA).' },
      { heading: 'Filing a DMCA Notice', body: 'To file a DMCA takedown notice, send a written notice to dmca@archangelsclub.com containing: (1) identification of the copyrighted work, (2) identification of the infringing material and its location, (3) your contact information, (4) a statement of good faith belief, and (5) a statement that the information is accurate under penalty of perjury.' },
      { heading: 'Counter-Notice', body: 'If you believe your content was removed in error, you may submit a counter-notice to dmca@archangelsclub.com with the required statutory information.' },
      { heading: 'Repeat Infringers', body: 'Archangels Club will terminate accounts of users who are repeat copyright infringers.' },
    ],
  },
  'age-verification': {
    title: 'Age Verification',
    sections: [
      { heading: 'Why We Verify Age', body: 'Archangels Club is an adult platform (18+). We are legally required and ethically committed to ensuring that only adults can access this platform and its content.' },
      { heading: 'Verification Process', body: 'During the access request process, you must confirm your date of birth and agree that you are 18 or older. Creator accounts are subject to additional identity verification.' },
      { heading: 'Creator Documentation', body: 'All creators must provide government-issued identification confirming they are 18 or older before any content may be published. This is a strict requirement with no exceptions.' },
      { heading: 'Parental Controls', body: 'We support parental control solutions and encourage parents to use filtering software to restrict access to adult content websites.' },
    ],
  },
  contact: {
    title: 'Contact Us',
    sections: [
      { heading: 'General Inquiries', body: 'For general questions about the platform, email support@archangelsclub.com.' },
      { heading: 'Creator Support', body: 'For creator-specific support including payouts, content questions, or account issues, email creators@archangelsclub.com.' },
      { heading: 'Legal & Compliance', body: 'For legal, DMCA, or compliance matters, email legal@archangelsclub.com.' },
      { heading: 'Privacy', body: 'For privacy-related requests, email privacy@archangelsclub.com.' },
      { heading: 'Response Times', body: 'We aim to respond to all inquiries within 2 business days. Urgent compliance matters are prioritized.' },
    ],
  },
  report: {
    title: 'Report Content',
    sections: [
      { heading: 'How to Report', body: 'To report content that violates our policies, use the report button on any content page or profile, or email report@archangelsclub.com with a description of the issue and a link to the content.' },
      { heading: 'What to Report', body: 'Report content that depicts minors, non-consensual acts, content shared without the creator\'s consent, copyright infringement, or any other policy violation.' },
      { heading: 'CSAM Reporting', body: 'Any content depicting the sexual exploitation of minors is immediately reported to the National Center for Missing & Exploited Children (NCMEC) and relevant law enforcement. Zero tolerance, no exceptions.' },
      { heading: 'Response', body: 'All reports are reviewed by our trust and safety team. Content found to be in violation is removed and the account actioned. You will not receive updates on specific reports due to privacy constraints.' },
    ],
  },
  help: {
    title: 'Help Center',
    sections: [
      { heading: 'Getting Access', body: 'Submit an access request from the homepage. Our team reviews applications within 24–48 hours. Approved users receive an email and can sign in immediately.' },
      { heading: 'Account Issues', body: 'If you cannot log in or have been locked out, email support@archangelsclub.com from the email associated with your account.' },
      { heading: 'Payments & Subscriptions', body: 'Subscriptions renew automatically unless cancelled. To cancel, go to your account settings. For payment disputes, contact support@archangelsclub.com.' },
      { heading: 'Creator Applications', body: 'Approved members can apply to become creators from their dashboard. Applications are reviewed within 5 business days.' },
      { heading: 'Content Unlocks', body: 'Unlocked content is tied to your account and accessible as long as your account is in good standing.' },
      { heading: 'Still Need Help?', body: 'Email support@archangelsclub.com and include as much detail as possible about your issue.' },
    ],
  },
};

export default function StaticPage({ page }: { page: string }) {
  const content = CONTENT[page];

  if (!content) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p className="font-serif text-6xl text-gold mb-4">404</p>
          <p className="text-arc-secondary mb-6">Page not found.</p>
          <Link to="/" className="btn-gold">Return Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-arc-muted hover:text-white transition-colors mb-10">
          <ArrowLeft className="w-4 h-4" />
          Back to Archangels Club
        </Link>

        <span className="section-eyebrow mb-3 block">Legal</span>
        <h1 className="font-serif text-4xl text-white mb-12 leading-tight">{content.title}</h1>

        <div className="space-y-10">
          {content.sections.map(({ heading, body }) => (
            <div key={heading}>
              <h2 className="font-serif text-lg text-white mb-3">{heading}</h2>
              <p className="text-arc-secondary leading-relaxed text-sm">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-white/5">
          <p className="text-xs text-arc-muted">
            © {new Date().getFullYear()} Archangels Club. All rights reserved. Last updated April 2026.
          </p>
        </div>
      </div>
    </div>
  );
}
