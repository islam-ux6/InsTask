import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';

export default function TaskDetail() {
  const { id } = useParams(); // Получаем ID задачи из URL
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Состояния для формы отчета
  const [comment, setComment] = useState('');
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchTaskAndUser = async () => {
      try {
        const [taskRes, userRes] = await Promise.all([
          api.get(`/tasks/${id}/`),
          api.get('/users/me/')
        ]);
        setTask(taskRes.data);
        setUser(userRes.data);
      } catch (error) {
        console.error('Ошибка загрузки задачи', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTaskAndUser();
  }, [id]);

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Для отправки файлов нужен формат FormData
    const formData = new FormData();
    formData.append('task', id);
    formData.append('comment', comment);
    if (file) {
      formData.append('attached_file', file);
    }

    try {
      // Отправляем на эндпоинт отчетов
      const response = await api.post('/reports/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      // Добавляем новый отчет в список на экране без перезагрузки
      setTask({ ...task, reports: [...task.reports, response.data] });
      setComment('');
      setFile(null);
      // Можно также автоматически перевести статус в "На проверке"
    } catch (error) {
      console.error(error);
      alert('Ошибка при отправке отчета.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Загрузка задачи...</div>;
  if (!task) return <div className="p-8 text-center text-red-500">Задача не найдена</div>;

  const isAssignee = task.assignees.some(a => a.id === user?.id);

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <button onClick={() => navigate('/tasks')} className="text-blue-600 hover:underline mb-6 flex items-center text-sm font-medium">
        ← Вернуться к доске
      </button>

      {/* Карточка задачи */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-8 relative overflow-hidden">
        <div className={`absolute top-0 left-0 w-full h-1 ${
          task.status === 'completed' ? 'bg-green-500' : task.status === 'revision' ? 'bg-red-500' : 'bg-blue-500'
        }`}></div>
        
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-3xl font-bold text-gray-800">{task.title}</h1>
          <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-bold">
            {task.status_display}
          </span>
        </div>

        <p className="text-gray-600 text-lg mb-6 whitespace-pre-wrap">{task.description}</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-500 mb-1">Постановщик</p>
            <p className="font-semibold text-sm">{task.creator.last_name} {task.creator.first_name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Дедлайн</p>
            <p className="font-semibold text-sm text-red-600">{new Date(task.deadline).toLocaleString('ru-RU')}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-gray-500 mb-1">Исполнители</p>
            <div className="flex flex-wrap gap-2">
              {task.assignees.map(a => (
                <span key={a.id} className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded border border-blue-100">
                  {a.last_name} {a.first_name[0]}.
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Секция отчетов */}
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Отчеты и обсуждение</h2>
      
      <div className="space-y-4 mb-8">
        {task.reports && task.reports.length > 0 ? (
          task.reports.map(report => (
            <div key={report.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-gray-800">{report.author?.last_name || 'Сотрудник'}</span>
                <span className="text-xs text-gray-400">{new Date(report.submitted_at).toLocaleString('ru-RU')}</span>
              </div>
              <p className="text-gray-700 text-sm mb-3 whitespace-pre-wrap">{report.comment}</p>
              
              {report.attached_file && (
                <a 
                  href={report.attached_file} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg transition"
                >
                  📎 Скачать прикрепленный файл
                </a>
              )}
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            Отчетов пока нет.
          </p>
        )}
      </div>

      {/* Форма для добавления отчета (видна исполнителям) */}
      {isAssignee && task.status !== 'completed' && (
        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
          <h3 className="font-bold text-blue-900 mb-4">Прикрепить отчет о выполнении</h3>
          <form onSubmit={handleSubmitReport} className="space-y-4">
            <textarea 
              required
              rows="3" 
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Опишите, что было сделано..."
              className="w-full px-4 py-3 rounded-xl border border-blue-200 focus:ring-2 focus:ring-blue-500 outline-none"
            ></textarea>
            
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <input 
                type="file" 
                onChange={(e) => setFile(e.target.files[0])}
                className="w-full sm:w-auto text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
              />
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium px-6 py-2 rounded-lg transition"
              >
                {isSubmitting ? 'Отправка...' : 'Отправить отчет'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}