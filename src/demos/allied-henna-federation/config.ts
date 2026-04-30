import type { DemoConfig } from '../../types/demo';
import MissionLaunchPage from './MissionLaunchPage';

const config: DemoConfig = {
  id: 'allied-henna-federation',
  title: 'Allied Henna Federation — Mission Launch',
  description: 'Launch a deep-space mission for the Rocinante. For authorised mission commanders only.',
  processId: 'Rocinante',

  branding: {
    primaryColor: '#0A1628',
    accentColor: '#00C8FF',
    backgroundColor: '#02060F',
    logo: '/logos/allied-henna-federation.svg',
  },

  customFormPage: MissionLaunchPage,
};

export default config;
