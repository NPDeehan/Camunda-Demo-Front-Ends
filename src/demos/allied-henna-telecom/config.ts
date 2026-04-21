import type { DemoConfig } from '../../types/demo';

const config: DemoConfig = {
  id: 'allied-henna-telecom',
  title: 'Allied Henna Telecom — Field Techie Helper',
  description:
    'Stuck on a job? Submit your blocking issue and our AI agent will analyse the problem and send a tailored suggestion back to you in the field.',
  processId: 'TelelcomTechieHelper',

  branding: {
    primaryColor: '#0D3B6E',
    accentColor: '#00A8E0',
    backgroundColor: '#F0F6FC',
    logo: '/logos/allied-henna-telecom.svg',
  },

  taskLoop: {
    taskDefinitionIds: ['SendSuggestionToTechie'],
    waitingTitle: 'Expert advice on the way',
    waitingSteps: [
      'Issue received',
      'Diagnosing the fault',
      'Preparing specialist advice',
      'Response ready…',
    ],
    successTitle: 'Issue Resolved',
    successMessage: 'Your field issue has been reviewed and a response has been sent. Stay safe out there.',
  },
};

export default config;
