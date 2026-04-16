import { useParams } from 'react-router-dom';
import { getDemoById } from '../utils/demoRegistry';

export function useDemoConfig() {
  const { demoId } = useParams<{ demoId: string }>();
  const config = demoId ? getDemoById(demoId) : undefined;
  return { config, demoId };
}
