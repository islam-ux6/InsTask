import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // НОВОЕ: Состояние для отслеживания (свернут сайдбар или нет)
  const [isCollapsed, setIsCollapsed] = useState(false); 

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    window.location.href = '/login';
  };

  const isActive = (path) => location.pathname === path ? "bg-blue-800 text-white" : "hover:bg-blue-800 text-blue-100";

  // НОВОЕ: Вынесли меню в массив, чтобы отделить иконки от текста при сворачивании
  const menuItems = [
    { path: '/', icon: '📊', label: 'Главная' },
    { path: '/tasks', icon: '📋', label: 'Задачи' },
    { path: '/departments', icon: '🏢', label: 'Кафедры' },
    { path: '/profile', icon: '👤', label: 'Мой профиль' },
  ];

  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      
      {/* Боковое меню (Sidebar) */}
      {/* ИЗМЕНЕНО: Ширина динамически меняется с w-64 на w-20 с плавной анимацией */}
      <aside className={`${isCollapsed ? 'w-20' : 'w-64'} bg-blue-900 text-white flex flex-col shadow-xl hidden md:flex shrink-0 transition-all duration-300 ease-in-out z-20`}>
        
        <div className="p-6 text-center border-b border-blue-800 whitespace-nowrap overflow-hidden flex items-center justify-center h-20">
          <h2 className={`font-bold tracking-wider transition-all duration-300 ${isCollapsed ? 'text-xl' : 'text-2xl'}`}>
            {isCollapsed ? 'ERP' : <>ERP<span className="text-blue-400">System</span></>}
          </h2>
        </div>
        
        <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => (
            <Link 
              key={item.path}
              to={item.path} 
              className={`flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-4'} py-3 rounded-lg transition-all ${isActive(item.path)}`}
              title={isCollapsed ? item.label : ''} // В свернутом виде показываем подсказку при наведении
            >
              <span className="text-xl">{item.icon}</span>
              {/* Текст скрывается, если меню свернуто */}
              {!isCollapsed && <span className="ml-3 whitespace-nowrap">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-blue-800 mt-auto">
          <button 
            onClick={handleLogout}
            className={`w-full bg-blue-800 hover:bg-red-600 text-white p-3 rounded-lg transition-colors flex items-center justify-center`}
            title="Выйти"
          >
            <span className="text-xl">🚪</span>
            {!isCollapsed && <span className="ml-2 whitespace-nowrap font-medium">Выйти</span>}
          </button>
        </div>
      </aside>

      {/* Основной контент */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* НОВОЕ: Верхняя панель (Header) с кнопкой сворачивания */}
        <header className="bg-white border-b border-gray-200 h-20 shrink-0 flex items-center px-6 shadow-sm z-10">
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-100"
            title={isCollapsed ? "Развернуть меню" : "Свернуть меню"}
          >
            {/* Иконка бургер-меню (SVG) */}
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </header>
        
        <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
}