import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const BOARD_COLUMNS = [
  { id: 'created', title: 'Созданы', bg: 'bg-gray-100', border: 'border-gray-200' },
  { id: 'in_progress', title: 'В работе', bg: 'bg-blue-50', border: 'border-blue-200' },
  { id: 'on_review', title: 'На проверке', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  { id: 'revision', title: 'На доработке', bg: 'bg-red-50', border: 'border-red-200' },
  { id: 'completed', title: 'Завершены', bg: 'bg-green-50', border: 'border-green-200' },
];

export default function Tasks() {
  const navigate = useNavigate(); // Инициализируем хук навигации

  const [tasks, setTasks] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Вкладка по умолчанию
  const [activeTab, setActiveTab] = useState('assigned_to_me');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [depsList, setDepsList] = useState([]);
  const [newTask, setNewTask] = useState({
    title: '', description: '', deadline: '', 
    assignees_ids: [], target_departments_ids: []
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userRes, tasksRes, usersListRes, depsListRes] = await Promise.all([
          api.get('/users/me/'),
          api.get('/tasks/'),
          api.get('/users/'),
          api.get('/departments/').catch(() => ({ data: [] }))
        ]);
        setUser(userRes.data);
        setTasks(tasksRes.data);
        setUsersList(usersListRes.data);
        setDepsList(depsListRes.data);
      } catch (error) {
        console.error('Ошибка загрузки данных', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleDragStart = (e, taskId) => e.dataTransfer.setData('taskId', taskId);
  const handleDragOver = (e) => e.preventDefault(); 
  
  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const task = tasks.find(t => t.id === parseInt(taskId));
    if (!task || task.status === newStatus) return;

    try {
      await api.patch(`/tasks/${taskId}/`, { status: newStatus });
      setTasks(tasks.map(t => t.id === parseInt(taskId) ? { ...t, status: newStatus } : t));
    } catch (error) {
      alert('Ошибка при изменении статуса. Проверьте права доступа.');
    }
  };

  const handleAccept = async (taskId) => {
    try {
      await api.post(`/tasks/${taskId}/accept/`);
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status: 'in_progress' } : t));
    } catch (error) {
      alert('Не удалось принять задачу.');
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/tasks/', newTask);
      setTasks([response.data, ...tasks]);
      setIsModalOpen(false);
      setNewTask({ title: '', description: '', deadline: '', assignees_ids: [], target_departments_ids: [] });
      setActiveTab('created_by_me');
    } catch (error) {
      alert('Ошибка при создании задачи. Проверьте заполнение полей.');
    }
  };

  const handleMultiSelect = (e, field) => {
    const selected = Array.from(e.target.selectedOptions, option => parseInt(option.value));
    setNewTask({ ...newTask, [field]: selected });
  };

  if (loading) return <div className="text-gray-500 p-8 flex justify-center">Загрузка доски...</div>;

  const isAdmin = user?.is_manager || user?.is_rectorate;

    // === УМНАЯ ФИЛЬТРАЦИЯ ЗАДАЧ ПО ВКЛАДКАМ ===
    const filteredTasks = tasks.filter(task => {
    if (activeTab === 'assigned_to_me') {
        // 1. Задача назначена ЛИЧНО мне (даже если я сам себе её поставил)
        const isExplicitAssignee = task.assignees.some(a => a.id === user.id);
        
        // 2. Задача отправлена на мою кафедру, НО её создал КТО-ТО ДРУГОЙ (например, ректор)
        const isMyDeptTask = user.department && task.target_departments.some(d => d.id === user.department);
        const isCreatedBySomeoneElse = task.creator?.id !== user.id;
        
        // Показываем в "Назначили мне", только если я исполнитель, 
        // ЛИБО задача прилетела на кафедру от начальства
        return isExplicitAssignee || (isMyDeptTask && isCreatedBySomeoneElse);
    } 
    if (activeTab === 'created_by_me') {
        // Задачи, где постановщик — я
        return task.creator?.id === user.id;
    }
    if (activeTab === 'all') {
        // Все задачи института (для ректората)
        return true;
    }
    return false;
    });
    
  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col relative">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-3xl font-bold text-gray-800">Доска задач</h1>
        {isAdmin && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition"
          >
            + Создать задачу
          </button>
        )}
      </div>

      {/* === ПАНЕЛЬ ВКЛАДОК === */}
      <div className="flex space-x-1 border-b border-gray-200 mb-6 mt-2">
        <button 
          onClick={() => setActiveTab('assigned_to_me')}
          className={`px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'assigned_to_me' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
        >
          Назначили мне
        </button>
        
        {isAdmin && (
          <button 
            onClick={() => setActiveTab('created_by_me')}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'created_by_me' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
          >
            Поручил я
          </button>
        )}

        {user?.is_rectorate && (
          <button 
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'all' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
          >
            Все задачи института
          </button>
        )}
      </div>

      {/* КАНБАН ДОСКА (Колонки) */}
      <div className="flex-1 overflow-x-auto pb-4 flex space-x-6 items-start">
        {BOARD_COLUMNS.map(column => {
          const columnTasks = filteredTasks.filter(t => t.status === column.id);
          return (
            <div key={column.id} className={`min-w-[320px] max-w-[320px] rounded-xl flex flex-col max-h-full border ${column.bg} ${column.border}`} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, column.id)}>
              <div className="p-4 border-b border-white/50 flex justify-between items-center">
                <h3 className="font-bold text-gray-700">{column.title}</h3>
                <span className="bg-white/60 text-gray-600 text-xs font-bold px-2 py-1 rounded-full">{columnTasks.length}</span>
              </div>
              <div className="p-3 flex-1 overflow-y-auto space-y-3">
                {columnTasks.map(task => (
                  <div 
                    key={task.id} 
                    draggable={isAdmin} 
                    onDragStart={(e) => handleDragStart(e, task.id)} 
                    // ВОТ ЗДЕСЬ ДОБАВЛЕНА НАВИГАЦИЯ ПРИ КЛИКЕ:
                    onClick={() => navigate(`/tasks/${task.id}`)}
                    className={`bg-white p-4 rounded-lg shadow-sm border border-gray-100 group cursor-pointer 
                      ${isAdmin ? 'active:cursor-grabbing hover:border-blue-300' : 'hover:border-blue-300'}`}
                  >
                    <h4 className="font-bold text-gray-800 text-sm mb-1">{task.title}</h4>
                    <p className="text-xs text-gray-500 line-clamp-2 mb-3">{task.description}</p>
                    <div className="flex justify-between items-end">
                      <div className="flex -space-x-2">
                        {task.assignees.map((a, index) => (
                          <div key={index} title={`${a.last_name} ${a.first_name}`} className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 border border-white flex items-center justify-center text-[10px] font-bold">
                            {a.first_name ? a.first_name[0] : a.username[0]}
                          </div>
                        ))}
                      </div>
                      {!isAdmin && task.status === 'created' && (
                        <button 
                          // ВАЖНО: Останавливаем клик, чтобы не перекинуло на страницу
                          onClick={(e) => {
                            e.stopPropagation(); 
                            handleAccept(task.id);
                          }} 
                          className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded text-xs font-semibold"
                        >
                          Взять в работу
                        </button>
                      )}
                      <div className="text-[10px] text-gray-400 font-medium bg-gray-50 px-2 py-1 rounded">
                        {new Date(task.deadline).toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                  </div>
                ))}
                {columnTasks.length === 0 && (
                  <div className="text-center text-gray-400 text-sm py-4 border-2 border-dashed border-gray-200 rounded-lg">
                    Нет задач
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* МОДАЛЬНОЕ ОКНО СОЗДАНИЯ ЗАДАЧИ */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800">Новая задача</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500 font-bold text-xl">&times;</button>
            </div>
            
            <form onSubmit={handleCreateTask} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название</label>
                <input type="text" required value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
                <textarea required rows="3" value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"></textarea>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Дедлайн</label>
                <input type="datetime-local" required value={newTask.deadline} onChange={e => setNewTask({...newTask, deadline: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Исполнители (удерживайте Ctrl/Cmd для выбора нескольких)</label>
                <select multiple value={newTask.assignees_ids} onChange={e => handleMultiSelect(e, 'assignees_ids')} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]">
                  {usersList.map(u => (
                    <option key={u.id} value={u.id}>{u.last_name} {u.first_name} ({u.position_display !== 'Нет административной должности' ? u.position_display : u.teaching_status_display})</option>
                  ))}
                </select>
              </div>

              {depsList.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Целевые кафедры (Общая задача)</label>
                  <select multiple value={newTask.target_departments_ids} onChange={e => handleMultiSelect(e, 'target_departments_ids')} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px]">
                    {depsList.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-4 border-t flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Отмена</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow">Создать задачу</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}