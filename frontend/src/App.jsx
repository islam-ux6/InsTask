import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';
import Profile from './pages/Profile';
import Tasks from './pages/Tasks';
import TaskDetail from './pages/TaskDetail';
import Departments from './pages/Departments';

// Вспомогательный компонент для защиты маршрутов
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = !!localStorage.getItem('access');
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  // Оборачиваем защищенную страницу в наш красивый Layout
  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Защищенные страницы */}
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        {/* Сюда мы добавим <Route path="/tasks" ... /> на следующем шаге */}
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/profile/:id" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
        <Route path="/tasks/:id" element={<ProtectedRoute><TaskDetail /></ProtectedRoute>} />
        <Route path="/departments" element={<ProtectedRoute><Departments /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;