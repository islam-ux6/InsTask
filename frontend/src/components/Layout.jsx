import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api'; // Если Layout.jsx лежит в корне src/, измените на './api'

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { t, i18n } = useTranslation();

  // Состояния для колокольчика уведомлений
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifFilter, setNotifFilter] = useState('all'); // 'all' | 'unread'
  const [currentUserId, setCurrentUserId] = useState(null);
  const dropdownRef = useRef(null);

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    window.location.href = '/login';
  };

  const isActive = (path) =>
    location.pathname === path
      ? "bg-blue-800 text-white"
      : "hover:bg-blue-800 text-blue-100";

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng);
  };

  // Закрытие выпадающего списка уведомлений при клике вне его области
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Загрузка и формирование уведомлений
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const [meRes, tasksRes] = await Promise.all([
          api.get('/users/me/'),
          api.get('/tasks/')
        ]);

        const user = meRes.data;
        const tasks = tasksRes.data || [];
        setCurrentUserId(user.id);

        const storageKey = `erp_read_notifications_${user.id}`;
        const savedRead = JSON.parse(localStorage.getItem(storageKey) || '[]');
        setReadIds(savedRead);

        const list = [];

        // 1. Уведомления по задачам
        tasks.forEach((task) => {
          const isAssignee = task.assignees?.some((a) => a.id === user.id);
          const isCreator = task.creator?.id === user.id;

          // Новая назначенная задача
          if (isAssignee && task.status === 'created') {
            list.push({
              id: `task_new_${task.id}`,
              type: 'new_task',
              titleKey: 'notifications.new_task',
              subtitle: task.title,
              date: task.created_at,
              link: `/tasks/${task.id}`
            });
          }

          // Задача возвращена на доработку
          if (isAssignee && task.status === 'revision') {
            list.push({
              id: `task_rev_${task.id}_${task.revision_count}`,
              type: 'revision',
              titleKey: 'notifications.task_revision',
              subtitle: task.title,
              date: task.created_at,
              link: `/tasks/${task.id}`
            });
          }

          // Задача ожидает проверки (для постановщика)
          if (isCreator && task.status === 'on_review') {
            list.push({
              id: `task_review_${task.id}_${task.revision_count}`,
              type: 'on_review',
              titleKey: 'notifications.task_on_review',
              subtitle: task.title,
              date: task.created_at,
              link: `/tasks/${task.id}`
            });
          }

          // Задача принята и завершена
          if (isAssignee && task.status === 'completed') {
            const scoreStr = task.quality_score ? ` (${task.quality_score}/5 ★)` : '';
            list.push({
              id: `task_done_${task.id}`,
              type: 'completed',
              titleKey: 'notifications.task_completed',
              subtitle: `${task.title}${scoreStr}`,
              date: task.completed_at || task.created_at,
              link: `/tasks/${task.id}`
            });
          }
        });

        // 2. Уведомления по личным достижениям и выговорам
        if (user.records && Array.isArray(user.records)) {
          user.records.forEach((rec) => {
            list.push({
              id: `record_${rec.id}`,
              type: rec.record_type === 'reward' ? 'reward' : 'reprimand',
              titleKey:
                rec.record_type === 'reward'
                  ? 'notifications.new_reward'
                  : 'notifications.new_reprimand',
              subtitle: rec.description,
              date: rec.created_at,
              link: '/profile'
            });
          });
        }

        // Сортируем от самых свежих к более старым
        list.sort((a, b) => new Date(b.date) - new Date(a.date));
        setNotifications(list);
      } catch (err) {
        console.error('Ошибка получения уведомлений:', err);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  const markAsRead = (notifId) => {
    if (!currentUserId) return;
    if (!readIds.includes(notifId)) {
      const updated = [...readIds, notifId];
      setReadIds(updated);
      localStorage.setItem(
        `erp_read_notifications_${currentUserId}`,
        JSON.stringify(updated)
      );
    }
  };

  const markAllAsRead = () => {
    if (!currentUserId) return;
    const allIds = notifications.map((n) => n.id);
    const merged = Array.from(new Set([...readIds, ...allIds]));
    setReadIds(merged);
    localStorage.setItem(
      `erp_read_notifications_${currentUserId}`,
      JSON.stringify(merged)
    );
  };

  const handleNotificationClick = (notif) => {
    markAsRead(notif.id);
    setShowNotifications(false);
    navigate(notif.link);
  };

  const unreadCount = notifications.filter((n) => !readIds.includes(n.id)).length;
  const displayedNotifications =
    notifFilter === 'unread'
      ? notifications.filter((n) => !readIds.includes(n.id))
      : notifications;

  const renderNotifIcon = (type) => {
    switch (type) {
      case 'new_task':
        return (
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
        );
      case 'revision':
      case 'reprimand':
        return (
          <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        );
      case 'on_review':
        return (
          <div className="w-9 h-9 rounded-xl bg-yellow-50 text-yellow-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      case 'reward':
      case 'completed':
      default:
        return (
          <div className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  const menuItems = [
    {
      path: '/',
      label: t('menu.home'),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
        </svg>
      )
    },
    {
      path: '/tasks',
      label: t('menu.tasks'),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      )
    },
    {
      path: '/departments',
      label: t('menu.departments'),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )
    },
    {
      path: '/profile',
      label: t('menu.profile'),
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    }
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
              <div className="flex-shrink-0">{item.icon}</div>
              {!isCollapsed && <span className="ml-3 whitespace-nowrap font-medium">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-blue-800 mt-auto">
          <button
            onClick={handleLogout}
            className={`w-full bg-blue-800 hover:bg-red-600 text-white p-3 rounded-lg transition-colors flex items-center ${isCollapsed ? 'justify-center' : 'justify-start px-4'}`}
            title={t('menu.logout')}
          >
            <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!isCollapsed && <span className="ml-3 whitespace-nowrap font-medium">{t('menu.logout')}</span>}
          </button>
        </div>
      </aside>

      {/* Основной контент */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Верхняя панель (Header) */}
        <header className="bg-white border-b border-gray-200 h-20 shrink-0 flex items-center px-6 shadow-sm z-30">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="ml-auto flex items-center gap-4 text-gray-600">
            {/* КОЛОКОЛЬЧИК УВЕДОМЛЕНИЙ */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2.5 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors focus:outline-none"
                title={t('notifications.title')}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shadow-sm">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* ВЫПАДАЮЩЕЕ ОКНО УВЕДОМЛЕНИЙ */}
              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50">
                  <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 text-sm">
                      {t('notifications.title')}
                    </h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        {t('notifications.mark_all_read')}
                      </button>
                    )}
                  </div>

                  {/* Фильтр: Все / Непрочитанные */}
                  <div className="flex gap-2 px-4 py-2 border-b border-gray-100 bg-white">
                    <button
                      onClick={() => setNotifFilter('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                        notifFilter === 'all'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {t('notifications.all')} ({notifications.length})
                    </button>
                    <button
                      onClick={() => setNotifFilter('unread')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                        notifFilter === 'unread'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {t('notifications.unread')} ({unreadCount})
                    </button>
                  </div>

                  <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
                    {displayedNotifications.length > 0 ? (
                      displayedNotifications.map((notif) => {
                        const isUnread = !readIds.includes(notif.id);
                        return (
                          <div
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={`p-4 flex items-start gap-3 cursor-pointer transition-colors hover:bg-gray-50 ${
                              isUnread ? 'bg-blue-50/40' : 'bg-white'
                            }`}
                          >
                            {renderNotifIcon(notif.type)}
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start gap-2">
                                <p className={`text-xs ${isUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-600'}`}>
                                  {t(notif.titleKey)}
                                </p>
                                {isUnread && (
                                  <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1"></span>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                                {notif.subtitle}
                              </p>
                              <p className="text-[10px] text-gray-400 mt-1">
                                {notif.date ? new Date(notif.date).toLocaleDateString('ru-RU') : ''}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-8 text-center text-gray-400 text-sm">
                        {t('notifications.empty')}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Переключатель языков */}
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <select
                value={i18n.language}
                onChange={(e) => changeLanguage(e.target.value)}
                className="bg-gray-50 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 cursor-pointer outline-none transition-colors"
              >
                <option value="ru">Русский</option>
                <option value="tk">Türkmen</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </header>

        <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
}