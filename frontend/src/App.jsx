import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

function App() {
  // Простая проверка: если есть токен, считаем пользователя авторизованным
  const isAuthenticated = !!localStorage.getItem('access');

  return (
    <BrowserRouter>
      <Routes>
        {/* Страница логина */}
        <Route path="/login" element={<Login />} />
        
        {/* Главная страница (защищена от неавторизованных) */}
        <Route 
          path="/" 
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />} 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;