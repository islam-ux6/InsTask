import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next'; // НОВОЕ: Хук переводов

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false); 
  
  // НОВОЕ: Подключаем функцию перевода (t) и объект i18n
  const { t, i18n } = useTranslation();

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    window.location.href = '/login';
  };

  const isActive = (path) => location.pathname === path ? "bg-blue-800 text-white" : "hover:bg-blue-800 text-blue-100";

  // НОВОЕ: Функция смены языка
  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng); // Запоминаем выбор пользователя
  };

  // ИЗМЕНЕНО: Теперь названия берутся из словарей через функцию t()
  const menuItems = [
    { path: '/', icon: '📊', label: t('menu.home') },
    { path: '/tasks', icon: '📋', label: t('menu.tasks') },
    { path: '/departments', icon: '🏢', label: t('menu.departments') },
    { path: '/profile', icon: '👤', label: t('menu.profile') },
  ];

  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      
      {/* Боковое меню (Sidebar) */}
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
              title={isCollapsed ? item.label : ''} 
            >
              <span className="text-xl">{item.icon}</span>
              {!isCollapsed && <span className="ml-3 whitespace-nowrap">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-blue-800 mt-auto">
          <button 
            onClick={handleLogout}
            className={`w-full bg-blue-800 hover:bg-red-600 text-white p-3 rounded-lg transition-colors flex items-center justify-center`}
            title={t('menu.logout')}
          >
            <span className="text-xl">🚪</span>
            {!isCollapsed && <span className="ml-2 whitespace-nowrap font-medium">{t('menu.logout')}</span>}
          </button>
        </div>
      </aside>

      {/* Основной контент */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* Верхняя панель (Header) */}
        <header className="bg-white border-b border-gray-200 h-20 shrink-0 flex items-center px-6 shadow-sm z-10">
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* НОВОЕ: Переключатель языков в правой части Header'а */}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xl" title="Язык интерфейса">🌐</span>
            <select 
              value={i18n.language} 
              onChange={(e) => changeLanguage(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 cursor-pointer outline-none"
            >
              <option value="ru">Русский</option>
              <option value="tk">Türkmen</option>
              <option value="en">English</option>
            </select>
          </div>
        </header>
        
        <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
}