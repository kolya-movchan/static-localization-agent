import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import NewJob from './pages/NewJob';
import JobDetail from './pages/JobDetail';
import Header from './components/Header';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/new" element={<NewJob />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
