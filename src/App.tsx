import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Hub from './pages/Hub';
import DemoShell from './components/DemoShell';
import DemoFormPage from './pages/DemoFormPage';
import DemoSuccessPage from './pages/DemoSuccessPage';
import DemoTaskLoopPage from './pages/DemoTaskLoopPage';
import DemoCustomPage from './pages/DemoCustomPage';
import NotFound from './pages/NotFound';
import './styles/global.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Hub />} />
          <Route path=":demoId" element={<DemoShell />}>
            <Route index element={<DemoFormPage />} />
            <Route path="success" element={<DemoSuccessPage />} />
            <Route path="tasks" element={<DemoTaskLoopPage />} />
            <Route path=":pageSlug" element={<DemoCustomPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
