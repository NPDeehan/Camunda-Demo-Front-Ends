import type { DemoConfig } from '../../types/demo';
import OnboardingPage from './OnboardingPage';

const config: DemoConfig = {
  id: 'allied-henna-onboarding',
  title: 'Allied Henna Bank Customer Onboarding',
  description:
    'Open a new Allied Henna Bank account. Our automated onboarding process verifies your identity, assesses eligibility, and has you banking in minutes.',
  processId: 'AlliedHennaCustomerOnboarding',
  branding: {
    primaryColor: '#1B3A6B',
    accentColor: '#C9971C',
    backgroundColor: '#F4F6FA',
    logo: '/logos/allied-henna.svg',
  },
  customFormPage: OnboardingPage,
};

export default config;
