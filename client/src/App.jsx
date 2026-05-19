// App.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Root component. Owns the active page state and renders the correct page.
// In a real Next.js app, the router replaces this entirely — each page
// becomes a file in /app/ and <Link> / useRouter handle navigation.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { AppProvider } from './hooks/useAppState';
import TopNav          from './components/ui/TopNav';
import ProvidersPage   from './pages/ProvidersPage';
import BenchmarkPage   from './pages/BenchmarkPage';
import DashboardPage   from './pages/DashboardPage';
import './index.css';

// Map of page id → component
const PAGES = {
  providers: ProvidersPage,
  benchmark: BenchmarkPage,
  dashboard: DashboardPage,
};

export default function App() {
  const [currentPage, setCurrentPage] = useState({
    page: 'providers',
    runId: null,
  });
  const [pageProps, setPageProps] = useState({});
  const PageComponent = PAGES[currentPage.page];
  const handleNavigate = (page, props = {}) => {
    setCurrentPage(page);
    setPageProps(props);
  };

  return (
    <AppProvider>
      <TopNav
        currentPage={currentPage.page}
        onNavigate={(page) =>
          setCurrentPage({ page, runId: null })
        }
      />

      <PageComponent
        onNavigate={setCurrentPage}
        runId={currentPage.runId}
      />
    </AppProvider>
  );
}
