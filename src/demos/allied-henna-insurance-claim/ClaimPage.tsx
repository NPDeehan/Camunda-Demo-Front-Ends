import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CustomFormPageProps } from '../../types/demo';
import { useStartForm } from '../../hooks/useStartForm';
import CamundaFormRenderer from '../../components/CamundaFormRenderer';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorBanner from '../../components/ErrorBanner';
import './ClaimPage.css';

const STATS = [
  { value: '98%', label: 'Claim approval rate' },
  { value: '< 24h', label: 'Average claim assessment' },
  { value: '250K+', label: 'Policyholders protected' },
  { value: '£0', label: 'Claim processing fee' },
];

const FEATURES = [
  {
    icon: '⚡',
    title: 'Fast Assessment',
    body: 'Submit your claim online and receive a decision within 24 hours — no waiting on hold, no lengthy paperwork.',
  },
  {
    icon: '🛡️',
    title: 'Full Policy Coverage',
    body: 'We process claims across all Allied Henna Insurance products: home, motor, health, and travel policies.',
  },
  {
    icon: '📄',
    title: 'Digital Documentation',
    body: 'Upload supporting documents directly in the form. Our system validates everything automatically.',
  },
  {
    icon: '💬',
    title: 'Dedicated Handler',
    body: 'A claims handler is assigned to every case. You will receive real-time email updates at every stage.',
  },
];

const TESTIMONIALS = [
  {
    quote: 'My home insurance claim after the flood was processed in less than a day. The team kept me updated throughout — completely stress-free.',
    name: 'James M.',
    location: 'Manchester, UK',
    initials: 'JM',
  },
  {
    quote: 'Filed a motor claim on Monday morning. By Tuesday I had the repair authorisation. Genuinely impressed by the speed and professionalism.',
    name: 'Sophie L.',
    location: 'Dublin, Ireland',
    initials: 'SL',
  },
  {
    quote: "After years of dreading insurance claims, Allied Henna has completely changed my expectations. Simple, fast, and fair.",
    name: 'Henrik B.',
    location: 'Edinburgh, UK',
    initials: 'HB',
  },
];

const TRUST_ITEMS = [
  { icon: '🏛️', label: 'FCA Regulated' },
  { icon: '⚖️', label: 'FOS Member' },
  { icon: '🔐', label: 'GDPR Compliant' },
  { icon: '📋', label: 'ICO Registered' },
  { icon: '🛡️', label: 'Lloyd\'s Approved' },
];

export default function ClaimPage({ config, onSubmit }: CustomFormPageProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { schema, loading, error } = useStartForm(config.processId, config.formSchema);

  const handleSubmit = async (data: Record<string, unknown>) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(data);
      setSubmitted(true);
    } catch (e) {
      setSubmitError((e as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div className="ahi-page">

      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav className="ahi-nav">
        <div className="ahi-nav-inner">
          <img src="/logos/allied-henna-insurance.svg" alt="Allied Henna Insurance" className="ahi-nav-logo" />
          <div className="ahi-nav-links">
            <a href="#features">Features</a>
            <a href="#testimonials">Reviews</a>
            <a href="#file-claim" className="ahi-nav-cta">File a Claim</a>
          </div>
          <Link to="/" className="ahi-nav-back">← Demo Hub</Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="ahi-hero">
        <div className="ahi-hero-inner">
          <div className="ahi-hero-text">
            <div className="ahi-hero-eyebrow">Trusted Claims Service · Allied Henna Insurance</div>
            <h1 className="ahi-hero-headline">
              Your claim,<br />
              <span className="ahi-hero-highlight">handled with care</span>
            </h1>
            <p className="ahi-hero-sub">
              Submit your insurance claim in minutes. Our AI-assisted validation process assesses your case immediately and delivers a decision within 24 hours — no delays, no hassle.
            </p>
            <a href="#file-claim" className="ahi-hero-btn">File My Claim Now →</a>
          </div>
          <div className="ahi-hero-visual">
            <div className="ahi-policy-mockup">
              <div className="ahi-policy-header">
                <div className="ahi-policy-shield">✓</div>
                <div>
                  <div className="ahi-policy-brand">Allied Henna Insurance</div>
                  <div className="ahi-policy-type">Comprehensive Policy</div>
                </div>
              </div>
              <div className="ahi-policy-divider" />
              <div className="ahi-policy-row">
                <span className="ahi-policy-key">Policy No.</span>
                <span className="ahi-policy-val">AHI-2024-••••-7821</span>
              </div>
              <div className="ahi-policy-row">
                <span className="ahi-policy-key">Status</span>
                <span className="ahi-policy-status">● Active</span>
              </div>
              <div className="ahi-policy-row">
                <span className="ahi-policy-key">Cover</span>
                <span className="ahi-policy-val">Up to £500,000</span>
              </div>
              <div className="ahi-policy-row">
                <span className="ahi-policy-key">Renewal</span>
                <span className="ahi-policy-val">15 Nov 2026</span>
              </div>
            </div>
            <div className="ahi-hero-badge ahi-hero-badge--tl">✓ 24h Decision</div>
            <div className="ahi-hero-badge ahi-hero-badge--br">£0 Processing Fee</div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="ahi-stats-bar">
          {STATS.map((s) => (
            <div key={s.label} className="ahi-stat">
              <span className="ahi-stat-value">{s.value}</span>
              <span className="ahi-stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section id="features" className="ahi-features-section">
        <div className="ahi-section-inner">
          <div className="ahi-section-header">
            <div className="ahi-eyebrow">Why Allied Henna Insurance</div>
            <h2>Claims made simple, settlements made fast</h2>
            <p>We have redesigned the claims experience from the ground up so you can focus on what matters — not paperwork.</p>
          </div>
          <div className="ahi-features-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="ahi-feature-card">
                <div className="ahi-feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Claim form ───────────────────────────────────────── */}
      <section id="file-claim" className="ahi-apply-section">
        <div className="ahi-apply-inner">

          <div className="ahi-apply-left">
            <div className="ahi-eyebrow">File Your Claim</div>
            <h2>Submit your claim in minutes</h2>
            <p>Fill in the details below and we will begin assessing your claim immediately. Our team will follow up by email with next steps.</p>

            <ul className="ahi-apply-checklist">
              <li>✓ Claim assessed within 24 hours</li>
              <li>✓ 100% digital — no branch visit required</li>
              <li>✓ Your data is encrypted end-to-end</li>
              <li>✓ Regulated by the Financial Conduct Authority</li>
            </ul>

            <div className="ahi-apply-testimonial">
              <p className="ahi-apply-testimonial-quote">"I submitted my claim at 9am and had a settlement offer by end of day. Remarkable service."</p>
              <div className="ahi-apply-testimonial-author">
                <div className="ahi-avatar ahi-avatar--sm">RO</div>
                <div>
                  <strong>Rachel O.</strong>
                  <span>Bristol, UK</span>
                </div>
              </div>
            </div>
          </div>

          <div className="ahi-apply-right">
            <div className={`ahi-card-flip-scene${submitted ? ' ahi-card-flip-scene--flipped' : ''}`}>
              <div className="ahi-card-flip-inner">

                {/* Front — claim form */}
                <div className="ahi-card-flip-face ahi-card-flip-face--front">
                  <div className="ahi-form-card">
                    <div className="ahi-form-card-header">
                      <img src="/logos/allied-henna-insurance.svg" alt="Allied Henna Insurance" className="ahi-form-logo" />
                      <p>Secure claim submission · FCA regulated</p>
                    </div>

                    {submitError && <ErrorBanner message={submitError} />}

                    {loading && <LoadingSpinner />}
                    {error && <ErrorBanner message={error} />}
                    {!loading && !error && schema && (
                      <CamundaFormRenderer
                        schema={schema}
                        submitLabel="Submit Claim"
                        submitting={submitting}
                        onSubmit={handleSubmit}
                      />
                    )}
                  </div>
                </div>

                {/* Back — confirmation */}
                <div className="ahi-card-flip-face ahi-card-flip-face--back">
                  <div className="ahi-form-card ahi-form-card--success">
                    <div className="ahi-form-card-header">
                      <img src="/logos/allied-henna-insurance.svg" alt="Allied Henna Insurance" className="ahi-form-logo" />
                    </div>
                    <div className="ahi-success-body">
                      <div className="ahi-success-icon">✓</div>
                      <h3>Claim submitted successfully!</h3>
                      <p>
                        We have received your claim and our validation process has begun. You will receive a confirmation email shortly with your claim reference number.
                      </p>
                      <p className="ahi-success-sub">Our team will be in touch within 24 hours with an assessment update.</p>
                      <div className="ahi-success-steps">
                        <div className="ahi-success-step ahi-success-step--done">
                          <span className="ahi-step-dot">✓</span>
                          <span>Claim submitted</span>
                        </div>
                        <div className="ahi-success-step">
                          <span className="ahi-step-dot">2</span>
                          <span>Assessment &amp; validation</span>
                        </div>
                        <div className="ahi-success-step">
                          <span className="ahi-step-dot">3</span>
                          <span>Settlement authorised</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────── */}
      <section id="testimonials" className="ahi-testimonials-section">
        <div className="ahi-section-inner">
          <div className="ahi-section-header">
            <div className="ahi-eyebrow">Customer Stories</div>
            <h2>Trusted by 250,000+ policyholders</h2>
          </div>
          <div className="ahi-testimonials-grid">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="ahi-testimonial-card">
                <div className="ahi-stars">★★★★★</div>
                <p className="ahi-testimonial-quote">"{t.quote}"</p>
                <div className="ahi-testimonial-author">
                  <div className="ahi-avatar">{t.initials}</div>
                  <div>
                    <strong>{t.name}</strong>
                    <span>{t.location}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust bar ────────────────────────────────────────── */}
      <div className="ahi-trust-bar">
        {TRUST_ITEMS.map((item) => (
          <div key={item.label} className="ahi-trust-item">
            <span className="ahi-trust-icon">{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="ahi-footer">
        <div className="ahi-footer-inner">
          <img src="/logos/allied-henna-insurance.svg" alt="Allied Henna Insurance" className="ahi-footer-logo" />
          <p className="ahi-footer-legal">
            Allied Henna Insurance Ltd is authorised and regulated by the Financial Conduct Authority (FCA Register No. 987654). Registered in England and Wales (Company No. 09876543). Registered office: 1 Finsbury Square, London, EC2A 1AE. Your policy and claims data is processed in accordance with the UK GDPR and Data Protection Act 2018. Insurance products are underwritten by Allied Henna Insurance Ltd. Claims decisions are subject to your policy terms and conditions.
          </p>
          <p className="ahi-footer-copy">© 2026 Allied Henna Insurance Ltd · Protecting What Matters · Trusted Claims Service</p>
        </div>
      </footer>

    </div>
  );
}
