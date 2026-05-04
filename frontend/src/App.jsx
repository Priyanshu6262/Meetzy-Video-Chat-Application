import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LandingPage from './pages/LandingPage';
import VideoChat from './pages/VideoChat';

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('meetzy-theme');
      return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('meetzy-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('meetzy-theme', 'light');
    }
  }, [darkMode]);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-indigo-500/30 flex flex-col">
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/meeting/:roomId" element={<VideoChat />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}

export default App;
