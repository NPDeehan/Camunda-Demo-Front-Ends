import { useParams } from 'react-router-dom';
import { useDemoConfig } from '../hooks/useDemoConfig';

export default function DemoCustomPage() {
  const { config } = useDemoConfig();
  const { pageSlug } = useParams<{ pageSlug: string }>();

  if (!config?.pages) return null;

  const page = config.pages.find((p) => p.path === pageSlug);
  if (!page) return <div>Page not found</div>;

  const PageComponent = page.component;
  return <PageComponent />;
}
