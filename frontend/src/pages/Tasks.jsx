import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function Tasks() {
  const [currentUser, setCurrentUser] = useState(null);
  
  // Данные с сервера
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [analytics, setAnalytics] = useState(null); // Для формы создания
  const [loading, setLoading] = useState(true);

  // Состояния интерфейса
  const [activeTab, setActiveTab] = useState('delegated'); // Будет переопределено после загрузки
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createError, setCreateError] = useState('');

  // Фильтры
  const [filterCreator, setFilterCreator] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterDept, setFilterDept] = useState('');

  // Форма новой задачи
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    deadline: '',
    assignee_ids: [],
    target_department_ids: []
  });

  const fetchData = async () => {
    try {
      const [meRes, tasksRes, usersRes, deptsRes, analyticsRes] = await Promise.all([
        api.get('/users/me/'),
        api.get('/tasks/'),
        api.get('/users/'),
        api.get('/departments/'),
        api.get('/analytics/dashboard/').catch(() => ({ data: null })) // Для умного селекта
      ]);
      
      const user = meRes.data;
      setCurrentUser(user);
      setTasks(tasksRes.data);
      setUsers(usersRes.data);
      setDepartments(deptsRes.data);
      if(analyticsRes.data) setAnalytics(analyticsRes.data);

      // Умная установка стартовой вкладки
      if (user.is_rectorate) {
        setActiveTab('all'); // Ректору не нужны "Мои задачи"
      } else {
        setActiveTab('my_tasks'); // Преподам и завам - нужны
      }

    } catch (error) {
      console.error("Ошибка загрузки данных задач:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- ЛОГИКА ФИЛЬТРАЦИИ И ВКЛАДОК ---
  const getFilteredTasks = () => {
    if (!currentUser) return [];
    
    let filtered = [...tasks];

    // 1. Фильтр по Вкладкам (Tabs)
    if (activeTab === 'my_tasks') {
      filtered = filtered.filter(t => t.assignees.some(a => a.id === currentUser.id));
    } else if (activeTab === 'delegated') {
      filtered = filtered.filter(t => t.creator.id === currentUser.id);
    } else if (activeTab === 'dept_all' && currentUser.department) {
      // Все задачи кафедры: либо назначены на кафедру, либо кому-то из сотрудников кафедры
      filtered = filtered.filter(t => 
        t.target_departments.some(d => d.id === currentUser.department) ||
        t.assignees.some(a => a.department === currentUser.department)
      );
    }

    // 2. Выпадающие фильтры (Dropdowns)
    if (filterCreator) {
      filtered = filtered.filter(t => t.creator.id === parseInt(filterCreator));
    }
    if (filterAssignee) {
      filtered = filtered.filter(t => t.assignees.some(a => a.id === parseInt(filterAssignee)));
    }
    if (filterDept) {
      filtered = filtered.filter(t => t.target_departments.some(d => d.id === parseInt(filterDept)));
    }

    return filtered;
  };

  // --- СОЗДАНИЕ ЗАДАЧИ ---
  const handleCreateTask = async (e) => {
    e.preventDefault();
    setCreateError('');

    // ЗАЩИТА: Запрещаем создавать задачи "в пустоту"
    if (newTask.assignee_ids.length === 0 && newTask.target_department_ids.length === 0) {
      setCreateError('Обязательно выберите хотя бы одного Исполнителя или Целевую кафедру!');
      return;
    }

    try {
      await api.post('/tasks/', {
        ...newTask,
        creator_id: currentUser.id
      });
      setShowCreateModal(false);
      setNewTask({ title: '', description: '', deadline: '', assignee_ids: [], target_department_ids: [] });
      fetchData(); // Обновляем доску
    } catch (error) {
      setCreateError('Ошибка при создании задачи. Проверьте правильность заполнения всех полей.');
      console.error(error);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Загрузка доски...</div>;

  const filteredTasks = getFilteredTasks();
  
  // Колонки Канбана
  const columns = [
    { id: 'created', title: 'Созданы', bg: 'bg-gray-100', text: 'text-gray-700' },
    { id: 'in_progress', title: 'В работе', bg: 'bg-blue-50', text: 'text-blue-800' },
    { id: 'on_review', title: 'На проверке', bg: 'bg-yellow-50', text: 'text-yellow-800' },
    { id: 'revision', title: 'Доработка', bg: 'bg-red-50', text: 'text-red-800' },
    { id: 'completed', title: 'Завершены', bg: 'bg-green-50', text: 'text-green-800' }
  ];

  return (
    <div className="max-w-[1400px] mx-auto pb-10 space-y-6">
      
      {/* ШАПКА И УПРАВЛЕНИЕ */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Менеджер задач</h1>
          
          {/* ВКЛАДКИ (Скрываем "Мои задачи" у Ректора) */}
          <div className="flex gap-4 mt-4 border-b border-gray-200 pb-1">
            {!currentUser.is_rectorate && (
              <button 
                onClick={() => setActiveTab('my_tasks')} 
                className={`pb-2 font-bold text-sm transition-colors ${activeTab === 'my_tasks' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
              >
                Мои задачи
              </button>
            )}
            <button 
              onClick={() => setActiveTab('delegated')} 
              className={`pb-2 font-bold text-sm transition-colors ${activeTab === 'delegated' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
            >
              Я поставил (Делегированные)
            </button>
            {currentUser.is_manager && (
              <button 
                onClick={() => setActiveTab('dept_all')} 
                className={`pb-2 font-bold text-sm transition-colors ${activeTab === 'dept_all' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
              >
                Все задачи кафедры
              </button>
            )}
            {currentUser.is_rectorate && (
              <button 
                onClick={() => setActiveTab('all')} 
                className={`pb-2 font-bold text-sm transition-colors ${activeTab === 'all' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}
              >
                Все задачи института
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
          {/* ФИЛЬТРЫ */}
          <select 
            value={filterCreator} onChange={(e) => setFilterCreator(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-blue-500"
          >
            <option value="">Постановщик: Все</option>
            {users.filter(u => u.is_rectorate || u.is_manager).map(u => (
              <option key={u.id} value={u.id}>{u.last_name} {u.first_name}</option>
            ))}
          </select>

          <select 
            value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-blue-500"
          >
            <option value="">Исполнитель: Все</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.last_name} {u.first_name}</option>
            ))}
          </select>

          {currentUser.is_rectorate && (
            <select 
              value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:border-blue-500"
            >
              <option value="">Кафедра: Все</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}

          <button 
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 transition flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <span>+</span> Создать задачу
          </button>
        </div>
      </div>

      {/* КАНБАН ДОСКА (С ДЕТАЛЬНЫМИ КАРТОЧКАМИ) */}
      <div className="flex overflow-x-auto gap-4 pb-4 min-h-[70vh]">
        {columns.map(col => (
          <div key={col.id} className={`${col.bg} border ${col.bg.replace('50', '200')} rounded-2xl p-4 min-w-[320px] w-full max-w-[380px] flex flex-col`}>
            <div className="flex justify-between items-center mb-4 px-2">
              <h3 className={`font-bold ${col.text}`}>{col.title}</h3>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full bg-white bg-opacity-60 text-gray-600`}>
                {filteredTasks.filter(t => t.status === col.id).length}
              </span>
            </div>
            
            <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1 pb-2">
              {filteredTasks.filter(t => t.status === col.id).map(task => {
                const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'completed';
                
                return (
                  <Link 
                    key={task.id} 
                    to={`/tasks/${task.id}`}
                    className="bg-white p-4 rounded-xl shadow-sm hover:shadow-md border border-gray-100 hover:border-blue-300 transition group cursor-pointer block"
                  >
                    {/* Верхняя строка карточки */}
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-xs font-bold ${isOverdue ? 'text-red-600' : 'text-gray-400'}`}>
                        {isOverdue ? '⚠️ ' : '⏳ '} 
                        {new Date(task.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-md" title="Постановщик">
                        <span className="font-medium text-gray-700">{task.creator?.last_name}</span>
                      </div>
                    </div>
                    
                    <h4 className="font-bold text-gray-800 text-sm mb-1 leading-snug group-hover:text-blue-600 transition">
                      {task.title}
                    </h4>
                    
                    <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                      {task.description}
                    </p>

                    {/* Нижняя строка карточки (Исполнители) */}
                    <div className="flex justify-between items-end border-t border-gray-50 pt-3">
                      <div className="flex -space-x-2">
                        {task.assignees?.slice(0, 3).map((a, i) => (
                          <div key={i} className="w-6 h-6 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-blue-700" title={`${a.last_name} ${a.first_name}`}>
                            {a.last_name.charAt(0)}
                          </div>
                        ))}
                        {task.assignees?.length > 3 && (
                          <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-gray-600">
                            +{task.assignees.length - 3}
                          </div>
                        )}
                        {task.assignees?.length === 0 && (
                          <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100">Кафедра</span>
                        )}
                      </div>
                      
                      {task.revision_count > 0 && (
                         <span className="text-[10px] text-red-500 font-bold bg-red-50 px-1.5 py-0.5 rounded">
                           Доработок: {task.revision_count}
                         </span>
                      )}
                    </div>
                  </Link>
                );
              })}
              {filteredTasks.filter(t => t.status === col.id).length === 0 && (
                <div className="text-center text-gray-400 text-sm mt-4 border-2 border-dashed border-gray-200 rounded-xl py-6 bg-white bg-opacity-40">
                  Нет задач
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* === МОДАЛЬНОЕ ОКНО СОЗДАНИЯ ЗАДАЧИ (С АНАЛИТИКОЙ) === */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800">Новая задача</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              {createError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-bold flex items-start gap-2">
                  <span>⚠️</span> {createError}
                </div>
              )}

              <form id="taskForm" onSubmit={handleCreateTask} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Название *</label>
                  <input 
                    type="text" required
                    className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={newTask.title}
                    onChange={e => setNewTask({...newTask, title: e.target.value})}
                    placeholder="Например: Подготовить методичку по Вышмату"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Подробное описание *</label>
                  <textarea 
                    rows="4" required
                    className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                    value={newTask.description}
                    onChange={e => setNewTask({...newTask, description: e.target.value})}
                    placeholder="Распишите требования и ожидаемый результат..."
                  ></textarea>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Дедлайн *</label>
                    <input 
                      type="datetime-local" required
                      className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={newTask.deadline}
                      onChange={e => setNewTask({...newTask, deadline: e.target.value})}
                    />
                  </div>
                  
                  {/* УМНЫЙ СЕЛЕКТ ИСПОЛНИТЕЛЕЙ С АНАЛИТИКОЙ */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1 flex justify-between">
                      <span>Исполнители</span>
                      <span className="text-xs font-normal text-gray-400">Можно несколько</span>
                    </label>
                    <select 
                      multiple
                      className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none h-28"
                      value={newTask.assignee_ids}
                      onChange={e => {
                        const values = Array.from(e.target.selectedOptions, option => option.value);
                        setNewTask({...newTask, assignee_ids: values});
                      }}
                    >
                      {users.map(u => {
                        // Подтягиваем аналитику из состояния
                        const stats = analytics?.employees?.find(emp => emp.id === u.id);
                        let statLabel = '';
                        if (stats) {
                           const active = stats.statuses.created + stats.statuses.in_progress + stats.statuses.revision;
                           const quality = stats.quality > 0 ? `★ ${stats.quality}` : 'Без оценок';
                           statLabel = ` | 🔥 В работе: ${active} | ${quality}`;
                        }
                        return (
                          <option key={u.id} value={u.id} className="py-1 border-b border-gray-50 text-sm">
                            {u.last_name} {u.first_name} {statLabel}
                          </option>
                        );
                      })}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Зажмите Ctrl (Cmd) для выбора нескольких</p>
                  </div>
                </div>

                {/* ВЫБОР КАФЕДРЫ (Только для ректора) */}
                {currentUser.is_rectorate && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1 flex justify-between">
                      <span>Целевые кафедры (Общая задача)</span>
                      <span className="text-xs font-normal text-gray-400">Опционально</span>
                    </label>
                    <select 
                      multiple
                      className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none h-24"
                      value={newTask.target_department_ids}
                      onChange={e => {
                        const values = Array.from(e.target.selectedOptions, option => option.value);
                        setNewTask({...newTask, target_department_ids: values});
                      }}
                    >
                      {departments.map(d => (
                        <option key={d.id} value={d.id} className="py-1 text-sm">{d.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </form>
            </div>
            
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setShowCreateModal(false)}
                className="px-5 py-2 rounded-xl text-gray-600 font-bold hover:bg-gray-200 transition"
              >
                Отмена
              </button>
              <button 
                type="submit" 
                form="taskForm"
                className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-md"
              >
                Создать и назначить
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}