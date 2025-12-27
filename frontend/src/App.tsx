import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAppStore } from './store/useAppStore';
import Layout from './components/Layout';
import MainPage from './pages/MainPage';
import ProjectPage from './pages/ProjectPage';

function App() {
  const { workingState, initializeEmpty, loadState, isLoading } = useAppStore();

  // Load initial state from API or initialize empty
  useEffect(() => {
    const fetchInitialState = async () => {
      try {
        const response = await fetch('/api/state');
        if (response.ok) {
          const data = await response.json();
          loadState(data);
        } else {
          // API not available, initialize with empty state
          initializeEmpty();
        }
      } catch {
        // Network error, initialize with empty state
        initializeEmpty();
      }
    };

    if (!workingState && !isLoading) {
      fetchInitialState();
    }
  }, [workingState, isLoading, loadState, initializeEmpty]);

  // Show loading state
  if (!workingState) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          color: 'var(--text-secondary)',
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/project/:projectId" element={<ProjectPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
