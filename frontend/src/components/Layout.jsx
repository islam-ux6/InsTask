import { Link, useNavigate, useLocation } from 'react-router-dom';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    window.location.href = '/login';
  };

  // Функция для подсветки активного пункта меню
  const isActive = (path) => location.pathname === path ? "bg-blue-800 text-white" : "hover:bg-blue-800 text-blue-100";

  return (
    // 1. ИЗМЕНЕНО: Зафиксировали высоту на h-screen и запретили общий скролл (overflow-hidden)
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      
      {/* Боковое меню (Sidebar) */}
      {/* 2. ИЗМЕНЕНО: Добавлен shrink-0, чтобы меню не сжималось */}
      <aside className="w-64 bg-blue-900 text-white flex flex-col shadow-xl hidden md:flex shrink-0">
        <div className="p-6 text-center border-b border-blue-800">
          <h2 className="text-2xl font-bold tracking-wider">ERP<span className="text-blue-400">System</span></h2>
        </div>
        
        {/* 3. ИЗМЕНЕНО: Добавлен overflow-y-auto навигации (если ссылок станет слишком много, они будут скроллиться, а кнопка "Выйти" останется на месте) */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
          <Link to="/" className={`block px-4 py-3 rounded-lg transition-colors ${isActive('/')}`}>
            📊 Главная
          </Link>
          <Link to="/tasks" className={`block px-4 py-3 rounded-lg transition-colors ${isActive('/tasks')}`}>
            📋 Задачи
          </Link>
          <Link to="/departments" className={`block px-4 py-3 rounded-lg transition-colors ${isActive('/departments')}`}>
            🏢 Кафедры
          </Link>
          <Link to="/profile" className={`block px-4 py-3 rounded-lg transition-colors ${isActive('/profile')}`}>
            👤 Мой профиль
          </Link>
        </nav>

        <div className="p-4 border-t border-blue-800 mt-auto">
          <button 
            onClick={handleLogout}
            className="w-full bg-blue-800 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            🚪 Выйти
          </button>
        </div>
      </aside>

      {/* Основной контент */}
      {/* 4. ИЗМЕНЕНО: Контент занимает оставшуюся ширину и скроллится только внутри себя */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Здесь можно добавить Header, и он тоже приклеится к верху */}
        
        <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
}