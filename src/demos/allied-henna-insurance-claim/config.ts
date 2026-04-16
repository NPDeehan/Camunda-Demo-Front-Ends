import type { DemoConfig } from '../../types/demo';
import ClaimPage from './ClaimPage';

const config: DemoConfig = {
  id: 'allied-henna-insurance-claim',
  title: 'Allied Henna Insurance Claim',
  description:
    'File a claim against your Allied Henna Insurance policy. Our AI-assisted validation process assesses your claim digitally and delivers a decision within 24 hours.',
  processId: 'InsuranceClaimValidationAgent',
  branding: {
    primaryColor: '#1B3A6B',
    accentColor: '#C9971C',
    backgroundColor: '#F4F6FA',
    logo: '/logos/allied-henna-insurance.svg',
  },
  customFormPage: ClaimPage,
};

export default config;
