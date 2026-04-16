import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CustomFormPageProps } from '../../types/demo';
import { useStartForm } from '../../hooks/useStartForm';
import CamundaFormRenderer from '../../components/CamundaFormRenderer';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorBanner from '../../components/ErrorBanner';
import './OnboardingPage.css';

const STATS = [
  { value: '500K+', label: 'Customers across Europe' },
  { value: '< 5 min', label: 'Average account opening' },
  { value: '32', label: 'EU countries covered' },
  { value: '€0', label: 'Monthly account fees' },
];

const FEATURES = [
  {
    icon: '⚡',
    title: 'Instant Onboarding',
    body: 'Open your account in minutes with our fully digital verification process. No branch visits, no paperwork.',
  },
  {
    icon: '🌍',
    title: 'Pan-European Banking',
    body: 'Send and receive money across all 32 EU/EEA countries with zero transfer fees and real exchange rates.',
  },
  {
    icon: '🔒',
    title: 'Bank-Grade Security',
    body: 'Your funds are protected by EU deposit guarantee schemes up to €100,000, with 256-bit encryption on every transaction.',
  },
  {
    icon: '📱',
    title: 'Mobile-First',
    body: 'Manage everything from your phone. Freeze cards, set budgets, and get instant push notifications on every spend.',
  },
];

const TESTIMONIALS = [
  {
    quote: 'Opening my account took less time than making a coffee. Allied Henna finally gets what modern banking should look like.',
    name: 'Maria S.',
    location: 'Brussels, Belgium',
    initials: 'MS',
  },
  {
    quote: 'I moved to Berlin for work and needed a local account fast. Allied Henna had me set up the same afternoon — completely in English too.',
    name: 'Thorsten K.',
    location: 'Berlin, Germany',
    initials: 'TK',
  },
  {
    quote: "As a freelancer working across borders, Allied Henna's zero-fee EU transfers save me hundreds every year. Can't imagine banking any other way.",
    name: 'Camille D.',
    location: 'Paris, France',
    initials: 'CD',
  },
];

const TRUST_ITEMS = [
  { icon: '🏛️', label: 'ECB Regulated' },
  { icon: '🛡️', label: '€100K Deposit Protection' },
  { icon: '🇪🇺', label: 'EU Passported' },
  { icon: '🔐', label: 'GDPR Compliant' },
  { icon: '📋', label: 'PSD2 Licensed' },
];

export default function OnboardingPage({ config, onSubmit }: CustomFormPageProps) {
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
    <div className="ah-page">

      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav className="ah-nav">
        <div className="ah-nav-inner">
          <img src="/logos/allied-henna.svg" alt="Allied Henna Bank" className="ah-nav-logo" />
          <div className="ah-nav-links">
            <a href="#features">Features</a>
            <a href="#testimonials">Reviews</a>
            <a href="#open-account" className="ah-nav-cta">Open Account</a>
          </div>
          <Link to="/" className="ah-nav-back">← Demo Hub</Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="ah-hero">
        <div className="ah-hero-inner">
          <div className="ah-hero-text">
            <div className="ah-hero-eyebrow">Digital Banking for Modern Europe</div>
            <h1 className="ah-hero-headline">
              Banking that<br />
              <span className="ah-hero-highlight">belongs to you</span>
            </h1>
            <p className="ah-hero-sub">
              Join half a million Europeans who chose Allied Henna for faster, fairer, fee-free banking. Open your account today in under five minutes.
            </p>
            <a href="#open-account" className="ah-hero-btn">Open My Account Free →</a>
          </div>
          <div className="ah-hero-visual">
            <div className="ah-card-mockup">
              <div className="ah-card-chip" />
              <div className="ah-card-logo">AH</div>
              <div className="ah-card-number">•••• •••• •••• 4291</div>
              <div className="ah-card-meta">
                <span>VALID THRU 04/30</span>
                <span>NIALL DEEHAN</span>
              </div>
              <div className="ah-card-network">VISA</div>
            </div>
            <div className="ah-hero-badge ah-hero-badge--tl">✓ Instant Approval</div>
            <div className="ah-hero-badge ah-hero-badge--br">€0 Monthly Fees</div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="ah-stats-bar">
          {STATS.map((s) => (
            <div key={s.label} className="ah-stat">
              <span className="ah-stat-value">{s.value}</span>
              <span className="ah-stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section id="features" className="ah-features-section">
        <div className="ah-section-inner">
          <div className="ah-section-header">
            <div className="ah-eyebrow">Why Allied Henna</div>
            <h2>Built for the way Europeans live</h2>
            <p>Whether you're a student, a professional, or a business owner, Allied Henna adapts to your life — not the other way around.</p>
          </div>
          <div className="ah-features-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="ah-feature-card">
                <div className="ah-feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Application form ─────────────────────────────────── */}
      <section id="open-account" className="ah-apply-section">
        <div className="ah-apply-inner">

          <div className="ah-apply-left">
            <div className="ah-eyebrow">Get Started</div>
            <h2>Open your account today</h2>
            <p>Fill in the short form and we'll verify your details instantly. No credit checks. No waiting periods.</p>

            <ul className="ah-apply-checklist">
              <li>✓ Takes less than 5 minutes</li>
              <li>✓ 100% online — no branch visit required</li>
              <li>✓ Your details are encrypted end-to-end</li>
              <li>✓ Regulated by the European Central Bank</li>
            </ul>

            <div className="ah-apply-testimonial">
              <p className="ah-apply-testimonial-quote">"The whole thing was done before I finished my lunch break."</p>
              <div className="ah-apply-testimonial-author">
                <div className="ah-avatar ah-avatar--sm">LP</div>
                <div>
                  <strong>Lena P.</strong>
                  <span>Amsterdam, Netherlands</span>
                </div>
              </div>
            </div>
          </div>

          <div className="ah-apply-right">
            <div className={`ah-card-flip-scene${submitted ? ' ah-card-flip-scene--flipped' : ''}`}>
              <div className="ah-card-flip-inner">

                {/* Front — application form */}
                <div className="ah-card-flip-face ah-card-flip-face--front">
                  <div className="ah-form-card">
                    <div className="ah-form-card-header">
                      <img src="/logos/allied-henna.svg" alt="Allied Henna Bank" className="ah-form-logo" />
                      <p>Free account · No obligations</p>
                    </div>

                    {submitError && <ErrorBanner message={submitError} />}

                    {loading && <LoadingSpinner />}
                    {error && <ErrorBanner message={error} />}
                    {!loading && !error && schema && (
                      <CamundaFormRenderer
                        schema={schema}
                        submitLabel="Submit Application"
                        submitting={submitting}
                        onSubmit={handleSubmit}
                      />
                    )}
                  </div>
                </div>

                {/* Back — confirmation */}
                <div className="ah-card-flip-face ah-card-flip-face--back">
                  <div className="ah-form-card ah-form-card--success">
                    <div className="ah-form-card-header">
                      <img src="/logos/allied-henna.svg" alt="Allied Henna Bank" className="ah-form-logo" />
                    </div>
                    <div className="ah-success-body">
                      <div className="ah-success-icon">✓</div>
                      <h3>Thanks for your application!</h3>
                      <p>
                        We've received your details and started processing your account. You should expect an email shortly with an update about your application.
                      </p>
                      <p className="ah-success-sub">In the meantime, feel free to explore what's coming your way.</p>
                      <div className="ah-success-steps">
                        <div className="ah-success-step ah-success-step--done">
                          <span className="ah-step-dot">✓</span>
                          <span>Application submitted</span>
                        </div>
                        <div className="ah-success-step">
                          <span className="ah-step-dot">2</span>
                          <span>Identity verification</span>
                        </div>
                        <div className="ah-success-step">
                          <span className="ah-step-dot">3</span>
                          <span>Account activated</span>
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
      <section id="testimonials" className="ah-testimonials-section">
        <div className="ah-section-inner">
          <div className="ah-section-header">
            <div className="ah-eyebrow">Customer Stories</div>
            <h2>Trusted by 500,000+ Europeans</h2>
          </div>
          <div className="ah-testimonials-grid">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="ah-testimonial-card">
                <div className="ah-stars">★★★★★</div>
                <p className="ah-testimonial-quote">"{t.quote}"</p>
                <div className="ah-testimonial-author">
                  <div className="ah-avatar">{t.initials}</div>
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
      <div className="ah-trust-bar">
        {TRUST_ITEMS.map((item) => (
          <div key={item.label} className="ah-trust-item">
            <span className="ah-trust-icon">{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="ah-footer">
        <div className="ah-footer-inner">
          <img src="/logos/allied-henna.svg" alt="Allied Henna Bank" className="ah-footer-logo" />
          <p className="ah-footer-legal">
            Allied Henna Bank N.V. is authorised and regulated by the European Central Bank and licensed under the EU Payment Services Directive 2 (PSD2). Deposits are protected up to €100,000 per eligible depositor under the EU Deposit Guarantee Schemes Directive. Allied Henna Bank N.V. is registered in the Netherlands (Chamber of Commerce No. 12345678).
          </p>
          <p className="ah-footer-copy">© 2026 Allied Henna Bank N.V. · Banking with Purpose · Built for Europe</p>
        </div>
      </footer>

    </div>
  );
}
