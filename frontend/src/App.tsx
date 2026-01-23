import { Routes, Route, Navigate } from 'react-router-dom';
import CreateSession from './components/CreateSession';
import SessionView from './components/SessionView';

function App() {
  return (
    <div className="min-h-screen bg-cinema-darker">
      <header className="bg-cinema-dark border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-white">
            <span className="text-cinema-accent">Movie</span> Night
          </h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<CreateSession />} />
          <Route path="/session/:sessionId" element={<SessionView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="border-t border-gray-800 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-gray-500 text-sm">
          Movie Night Coordinator - Coordinate movie nights with friends
        </div>
      </footer>
    </div>
  );
}

export default App;
