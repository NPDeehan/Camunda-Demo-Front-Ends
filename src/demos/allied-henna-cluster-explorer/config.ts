import type { DemoConfig } from '../../types/demo';
import ClusterExplorerPage from './ClusterExplorerPage';

const config: DemoConfig = {
  id: 'allied-henna-cluster-explorer',
  title: 'Allied Henna — Cluster Health Explorer',
  description:
    'Live health metrics for your Camunda SaaS cluster, plus an AI agent you can ask about anything happening in it.',
  processId: 'Camunda-Cluster-Explorer',

  branding: {
    primaryColor: '#003399',
    accentColor: '#FFCC00',
    logo: '/logos/allied-henna-cluster.svg',
  },

  customFormPage: ClusterExplorerPage,
};

export default config;
