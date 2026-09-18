import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer 
} from 'recharts';

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [currentUser, setCurrentUser] = useState(null);
  const [task, setTask] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const [comment, setComment] = useState('');
  const [file, setFile] = useState(null);
  const [submittingReport, setSubmittingReport] = useState(false);

  const fetchTaskData = async () => {
    try {
      const [meRes, taskRes, reportsRes] = await Promise.all([
        api.get('/users/me/'),
        api.get(`/tasks/${id}/`),
        api.get(`/reports/?task=${id}`).catch(() => ({ data: [] }))
      ]);
      
      setCurrentUser(meRes.data);
      setTask(taskRes.data);
      setReports(taskRes.data.reports || reportsRes.data || []);
      
    } catch (error) {
      console.error("Ошибка загрузки задачи:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaskData();
  }, [id]);

  const handleStatusChange = async (newStatus) => {
    try {
      await api.patch(`/tasks/${id}/`, { status: newStatus });
      fetchTaskData();
    } catch (error) {
      alert('Ошибка при изменении статуса');
      console.error(error);
    }
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setSubmittingReport(true);
    try {
      const formData = new FormData();
      formData.append('task', id);
      formData.append('comment', comment);
      if (file) formData.append('attached_file', file);
      
      await api.post('/reports/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setComment('');
      setFile(null);
      fetchTaskData(); 
    } catch (error) {
      alert('Ошибка при отправке отчета');
      console.error(error);
    } finally {
      setSubmittingReport(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Загрузка задачи...</div>;
  if (!task || !currentUser) return <div className="text-center text-gray-500 mt-20">Задача не найдена</div>;

  let timeMetrics = { created: 0, in_progress: 0, on_review: 0, revision: 0, completed: 0 };
  if (task.status_logs && task.status_logs.length > 0) {
    task.status_logs.forEach(log => {
      if (timeMetrics[log.status] !== undefined) timeMetrics[log.status] += (log.hours_spent || 0);
    });
  }
  Object.keys(timeMetrics).forEach(key => timeMetrics[key] = parseFloat(timeMetrics[key].toFixed(1)));

  const timeData = [{
    name: 'Часы',
    'Создана': timeMetrics.created,
    'В работе': timeMetrics.in_progress,
    'На проверке': timeMetrics.on_review,
    'На доработке': timeMetrics.revision,
  }];

  const isOverdue = new Date(task.deadline) < new Date() && task.status !== 'completed';
  const isAssignee = task.assignees?.some(a => a.id === currentUser.id);
  const isCreator = task.creator?.id === currentUser.id; 

  return (
    <div className="max-w-6xl mx-auto pb-10 space-y-6">
      <div className="mb-4">
        <button onClick={() => navigate(-1)} className="text-blue-600 hover:underline text-sm font-medium">
          &larr; Назад
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col lg:flex-row justify-between items-start gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <span className={`text-xs uppercase tracking-wider font-bold px-3 py-1 rounded-full ${
              task.status === 'completed' ? 'bg-green-100 text-green-700' :
              task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
              task.status === 'revision' ? 'bg-red-100 text-red-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
              {task.status_display || task.status}
            </span>
            {isOverdue && (
              <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">ПРОСРОЧЕНО</span>
            )}
          </div>
          <h1 className="text-3xl font-bold text-gray-800">{task.title}</h1>
          <p className="text-gray-600 mt-4 max-w-3xl whitespace-pre-wrap">{task.description}</p>
        </div>
        
        <div className="flex flex-col gap-2 min-w-[200px]">
          {task.status === 'created' && isAssignee && (
            <button onClick={() => handleStatusChange('in_progress')} className="bg-blue-600 text-white py-2 px-4 rounded-lg font-bold hover:bg-blue-700 transition">
              Взять в работу
            </button>
          )}
          {(task.status === 'in_progress' || task.status === 'revision') && isAssignee && (
            <button onClick={() => handleStatusChange('on_review')} className="bg-yellow-500 text-white py-2 px-4 rounded-lg font-bold hover:bg-yellow-600 transition">
              Отправить на проверку
            </button>
          )}
          
          {task.status === 'on_review' && isCreator && (
            <>
              <button onClick={() => handleStatusChange('completed')} className="bg-green-600 text-white py-2 px-4 rounded-lg font-bold hover:bg-green-700 transition">
                Принять (Завершить)
              </button>
              <button onClick={() => handleStatusChange('revision')} className="bg-red-600 text-white py-2 px-4 rounded-lg font-bold hover:bg-red-700 transition">
                Вернуть на доработку
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-800 text-lg mb-1">Таймлайн задержек</h3>
            <p className="text-sm text-gray-500 mb-6">Время, проведенное задачей в каждом статусе (в часах)</p>
            
            {/* ИСПРАВЛЕНИЕ: Теперь график показывается ВСЕГДА, если есть хотя бы 1 лог статуса (даже если прошло 0.0 часов) */}
            {task.status_logs && task.status_logs.length > 0 ? (
              <div className="w-full">
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart data={timeData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                    <YAxis type="category" dataKey="name" hide />
                    <ChartTooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '5px' }} />
                    <Bar dataKey="Создана" stackId="a" fill="#9ca3af" name="Ожидание (ч)" />
                    <Bar dataKey="В работе" stackId="a" fill="#3b82f6" name="В работе (ч)" />
                    <Bar dataKey="На проверке" stackId="a" fill="#f59e0b" name="На проверке (ч)" />
                    <Bar dataKey="На доработке" stackId="a" fill="#ef4444" name="На доработке (ч)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                
                {/* Текстовая расшифровка снизу */}
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-gray-100 pt-6">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 font-bold uppercase">Ожидание</p>
                    <p className="text-xl font-black text-gray-600">{timeMetrics.created} <span className="text-xs font-normal">ч.</span></p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-blue-400 font-bold uppercase">В работе</p>
                    <p className="text-xl font-black text-blue-600">{timeMetrics.in_progress} <span className="text-xs font-normal">ч.</span></p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-yellow-500 font-bold uppercase">Проверка</p>
                    <p className="text-xl font-black text-yellow-600">{timeMetrics.on_review} <span className="text-xs font-normal">ч.</span></p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-red-400 font-bold uppercase">Доработка</p>
                    <p className="text-xl font-black text-red-500">{timeMetrics.revision} <span className="text-xs font-normal">ч.</span></p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-6">Нет данных о смене статусов...</div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-800 text-lg">Отчеты и комментарии</h3>
            </div>
            
            {(isAssignee || isCreator) && task.status !== 'completed' && (
              <div className="p-6 border-b border-gray-100">
                <form onSubmit={handleSubmitReport}>
                  <textarea 
                    rows="3" 
                    required
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Напишите комментарий или прикрепите отчет..."
                    className="w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                  ></textarea>
                  <div className="flex justify-between items-center mt-3">
                    <input 
                      type="file" 
                      onChange={(e) => setFile(e.target.files[0])}
                      className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    />
                    <button 
                      type="submit" 
                      disabled={submittingReport}
                      className="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 disabled:bg-blue-300 transition"
                    >
                      {submittingReport ? 'Отправка...' : 'Оставить отчет'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="p-6 space-y-6">
              {reports.length > 0 ? reports.map((rep, index) => (
                <div key={index} className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold shrink-0">
                    {rep.author?.last_name ? rep.author.last_name.charAt(0) : 'U'}
                  </div>
                  <div className="flex-1 bg-gray-50 p-4 rounded-xl rounded-tl-none border border-gray-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-gray-800">
                        {rep.author ? `${rep.author.last_name} ${rep.author.first_name}` : 'Сотрудник'}
                      </span>
                      <span className="text-xs text-gray-500">{new Date(rep.submitted_at).toLocaleString('ru-RU')}</span>
                    </div>
                    <p className="text-gray-700 text-sm whitespace-pre-wrap">{rep.comment}</p>
                    {rep.attached_file && (
                      <a 
                        href={rep.attached_file} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-block mt-3 text-sm text-blue-600 hover:underline font-medium bg-blue-50 px-3 py-1.5 rounded-lg"
                      >
                        📎 Скачать прикрепленный файл
                      </a>
                    )}
                  </div>
                </div>
              )) : (
                <div className="text-center text-gray-400 py-4">Отчетов пока нет</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-3 mb-4">Информация</h3>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-gray-400 font-medium mb-1">Дедлайн</p>
                <p className={`font-bold ${isOverdue ? 'text-red-600' : 'text-gray-800'}`}>
                  {new Date(task.deadline).toLocaleString('ru-RU')}
                </p>
              </div>
              <div>
                <p className="text-gray-400 font-medium mb-1">Создана</p>
                <p className="text-gray-800 font-medium">{new Date(task.created_at).toLocaleString('ru-RU')}</p>
              </div>
              <div>
                <p className="text-gray-400 font-medium mb-1">Постановщик</p>
                <p className="text-gray-800 font-bold">
                  {task.creator?.last_name} {task.creator?.first_name}
                </p>
              </div>
              <div>
                <p className="text-gray-400 font-medium mb-1">Доработок</p>
                <p className="text-gray-800 font-medium">{task.revision_count}</p>
              </div>
              {task.quality_score && (
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-gray-400 font-medium mb-1">Оценка качества</p>
                  <p className="text-blue-600 font-bold text-lg">★ {task.quality_score} / 5</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-800 border-b border-gray-100 pb-3 mb-4">Исполнители</h3>
            {task.assignees && task.assignees.length > 0 ? (
              <ul className="space-y-3">
                {task.assignees.map(user => (
                  <li key={user.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                      {user.last_name?.charAt(0)}
                    </div>
                    <Link to={`/profile/${user.id}`} className="text-sm font-medium text-gray-800 hover:text-blue-600 transition">
                      {user.last_name} {user.first_name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Не назначены</p>
            )}

            {task.target_departments && task.target_departments.length > 0 && (
              <div className="mt-6">
                <h4 className="font-bold text-gray-800 border-b border-gray-100 pb-2 mb-3 text-sm">Целевые кафедры</h4>
                <ul className="space-y-2">
                  {task.target_departments.map(dept => (
                    <li key={dept.id} className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg">
                      {dept.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}