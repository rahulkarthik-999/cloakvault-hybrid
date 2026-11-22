import { StrictMode, lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { Landing } from './components/Landing';

const App = lazy(() => import('./App'));

function isWorkbenchRoute(): boolean {
  const { pathname, search } = window.location;
  // Chrome side-panel handoff (?clip=...) always lands straight in the workbench.
  return pathname.startsWith('/app') || new URLSearchParams(search).has('clip');
}

function Root() {
  const [workbench, setWorkbench] = useState(isWorkbenchRoute);

  useEffect(() => {
    const onNav = () => setWorkbench(isWorkbenchRoute());
    window.addEventListener('popstate', onNav);
    return () => window.removeEventListener('popstate', onNav);
  }, []);

  useEffect(() => {
    document.title = workbench
      ? 'CloakVault Workbench — Zero-leak hybrid AI'
      : 'CloakVault — Ask AI about confidential documents, without leaking them';
  }, [workbench]);

  if (!workbench) return <Landing />;
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center font-mono text-[12px] text-[#697083]">
          Opening local vault…
        </div>
      }
    >
      <App />
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
