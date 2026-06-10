import type { DemoConfig } from '../../types/demo';
import ChatPage from './ChatPage';

const config: DemoConfig = {
  id: 'allied-henna-agent',
  title: 'Allied Henna — Company Service Agent',
  description:
    'Chat with our AI-powered service agent. Ask about accounts, policies, or any Allied Henna service — powered by Camunda.',
  processId: 'CompanyServiceAgent',

  branding: {
    primaryColor: '#003399',
    accentColor: '#FFCC00',
    logo: '/logos/allied-henna-agent.svg',
  },

  customFormPage: ChatPage,
};

export default config;
