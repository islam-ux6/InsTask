import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer,
  Line, ComposedChart, Cell, ReferenceLine,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie // <-- Добавили PieChart
} from 'recharts';

export default function Dashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [myActiveTasks, setMyActiveTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [chartTarget, setChartTarget] = useState('all_emps'); 
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [meRes, tasksRes, analyticsRes] = await Promise.all([
          api.get('/users/me/'),
          api.get('/tasks/'),
          api.get('/analytics/dashboard/').catch(() => ({ data: null }))
        ]);
        
        const user = meRes.data;
        setCurrentUser(user);
        
        const data = analyticsRes.data;
        setAnalytics(data);
        
        if (data?.scope === 'institute') {
          setChartTarget('all_depts');
        }

        const myTasks = tasksRes.data.filter(t => 
          t.assignees.some(a => a.id === user.id) && t.status !== 'completed'
        );
        setMyActiveTasks(myTasks);

      } catch (error) {
        console.error("Ошибка загрузки:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  if (loading) return <div className="min-h-[calc(100vh-6rem)] flex items-center justify-center text-gray-500">Загрузка аналитики...</div>;
  if (!currentUser) return null;

  const isAdmin = currentUser.is_rectorate || currentUser.is_manager;

  // === ЛОГИКА ОТОБРАЖЕНИЯ ГРАФИКОВ ===
  const renderProductivityChart = () => {
    
    // 1. СРАВНЕНИЕ ВСЕХ КАФЕДР
    if (chartTarget === 'all_depts') {
      return (
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={analytics.departments} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
            <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} domain={[0, 100]} />
            <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8b5cf6' }} domain={[0, 5]} />
            <ChartTooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
            <Bar yAxisId="left" dataKey="completion_rate" name="Выполнено в срок (%)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
            <Line yAxisId="right" type="monotone" dataKey="quality" name="Среднее качество (1-5)" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 5 }} />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    // 2. СРАВНЕНИЕ СОТРУДНИКОВ
    if (chartTarget === 'all_emps' || chartTarget === 'all_emps_in_dept') {
      let dataToRender = analytics.employees;
      if (analytics.scope === 'institute' && selectedId && chartTarget === 'all_emps_in_dept') {
        dataToRender = analytics.employees.filter(e => e.department_id === parseInt(selectedId));
      }

      return (
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={dataToRender} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888' }} interval={0} angle={-30} textAnchor="end" height={60} />
            <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} domain={[0, 100]} />
            <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8b5cf6' }} domain={[0, 5]} />
            <ChartTooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
            <Bar yAxisId="left" dataKey="completion_rate" name="Выполнение задач (%)" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Line yAxisId="right" type="monotone" dataKey="quality" name="Качество (1-5)" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    // 3. АНАЛИЗ ЗАДЕРЖЕК
    if (chartTarget === 'bottlenecks_emps' || chartTarget === 'bottlenecks_depts') {
      const isDept = chartTarget === 'bottlenecks_depts';
      const sourceData = isDept ? analytics.departments : analytics.employees;
      
      const chartData = sourceData.map(item => ({
        name: item.name,
        in_progress: item.cycle_time?.in_progress || 0,
        on_review: item.cycle_time?.on_review || 0,
        revision: item.cycle_time?.revision || 0
      }));

      return (
        <div className="flex flex-col h-full">
          <div className="mb-4 text-center">
            <h4 className="font-bold text-gray-700">Где застревают задачи?</h4>
            <p className="text-xs text-gray-500">Среднее время нахождения в статусах (в часах)</p>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888' }} interval={0} angle={isDept ? 0 : -30} textAnchor={isDept ? "middle" : "end"} height={60} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
              <ChartTooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="in_progress" name="В работе (часы)" stackId="a" fill="#3b82f6" maxBarSize={40} />
              <Bar dataKey="on_review" name="На проверке (часы)" stackId="a" fill="#f59e0b" maxBarSize={40} />
              <Bar dataKey="revision" name="На доработке (часы)" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // 4. ТЕПЛОВАЯ КАРТА: ИНДЕКС ВЫГОРАНИЯ
    if (chartTarget === 'burnout') {
      const burnoutData = analytics.employees.map(emp => {
        const active = emp.statuses.created + emp.statuses.in_progress + emp.statuses.revision;
        return { ...emp, active_tasks: active };
      }).sort((a, b) => b.active_tasks - a.active_tasks);

      const totalActive = burnoutData.reduce((sum, emp) => sum + emp.active_tasks, 0);
      const calcAvg = burnoutData.length ? totalActive / burnoutData.length : 0;
      const avgActive = Math.max(calcAvg, 3);
      
      const overloaded = burnoutData.filter(emp => emp.active_tasks >= avgActive * 1.5);

      return (
        <div className="flex flex-col h-full">
          <div className="mb-4 flex flex-col md:flex-row justify-between items-center bg-red-50 p-4 rounded-xl border border-red-100">
            <div>
              <h4 className="font-bold text-red-900 text-lg">Тепловая карта нагрузки</h4>
              <p className="text-sm text-red-700">Оценка риска выгорания сотрудников на основе активных задач</p>
            </div>
            <div className="mt-2 md:mt-0 text-right">
              <span className="text-xs font-bold text-red-800 uppercase tracking-wider">В зоне риска: </span>
              <span className="bg-red-600 text-white px-3 py-1 rounded-lg font-bold text-sm ml-2">
                {overloaded.length} чел.
              </span>
            </div>
          </div>
          
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={burnoutData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888' }} interval={0} angle={-30} textAnchor="end" height={60} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
              <ChartTooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              
              <ReferenceLine 
                y={avgActive} 
                stroke="#f59e0b" 
                strokeDasharray="3 3" 
                label={{ position: 'top', value: `Норма нагрузки: ${avgActive.toFixed(1)}`, fill: '#f59e0b', fontSize: 11, fontWeight: 'bold' }} 
              />
              
              <Bar dataKey="active_tasks" name="Активных задач" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {burnoutData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.active_tasks >= avgActive * 1.5 ? '#ef4444' : entry.active_tasks > avgActive ? '#f59e0b' : '#10b981'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // 5. НОВОЕ: ОБЩИЙ ГРАФИК ДОРАБОТОК (REVISION RATE)
    if (chartTarget === 'revisions') {
      // Исключаем тех, у кого нет завершенных/активных задач
      const filteredEmps = analytics.employees.filter(e => e.revisions.total_evaluated > 0);
      
      return (
        <div className="flex flex-col h-full">
          <div className="mb-4 text-center">
            <h4 className="font-bold text-gray-700">Частота доработок по сотрудникам</h4>
            <p className="text-xs text-gray-500">Процент задач, сданных с первого раза (зеленый) против проблемных (красный)</p>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            {/* 100% Stacked Bar Chart */}
            <BarChart data={filteredEmps} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
              <XAxis type="number" axisLine={false} tickLine={false} domain={[0, 'dataMax']} hide />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#555', fontWeight: 'bold' }} width={90} />
              <ChartTooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              
              {/* Переводим в проценты для 100% графика */}
              <Bar dataKey="revisions.zero_revisions" name="С 1-го раза (0 возвратов)" stackId="a" fill="#10b981" />
              <Bar dataKey="revisions.one_revision" name="1 доработка" stackId="a" fill="#f59e0b" />
              <Bar dataKey="revisions.multiple_revisions" name="2 и более доработок" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // 6. КОНКРЕТНАЯ СУЩНОСТЬ (Воронка + Радар + Круговая диаграмма доработок)
    if (chartTarget === 'single') {
      let entity = analytics.employees.find(e => e.id === parseInt(selectedId));
      if (!entity) return <div className="text-center text-gray-400 mt-20">Выберите сотрудника для анализа</div>;

      const funnelData = [
        { name: 'Созданы', value: entity.statuses.created, fill: '#9ca3af' },
        { name: 'В работе', value: entity.statuses.in_progress, fill: '#3b82f6' },
        { name: 'Доработка', value: entity.statuses.revision, fill: '#ef4444' },
        { name: 'На проверке', value: entity.statuses.on_review, fill: '#f59e0b' },
        { name: 'Завершено', value: entity.statuses.completed, fill: '#10b981' }
      ];

      const radarData = [
        { subject: 'Качество', A: entity.radar?.quality || 0, fullMark: 100 },
        { subject: 'Дисциплина', A: entity.radar?.discipline || 0, fullMark: 100 },
        { subject: 'Автономность', A: entity.radar?.autonomy || 0, fullMark: 100 },
        { subject: 'Скорость', A: entity.radar?.speed || 0, fullMark: 100 },
        { subject: 'Объем', A: entity.radar?.volume || 0, fullMark: 100 },
      ];

      // Данные для круговой диаграммы доработок (Pie Chart)
      const revisionData = [
        { name: 'С первого раза', value: entity.revisions?.zero_revisions || 0, fill: '#10b981' },
        { name: '1 возврат', value: entity.revisions?.one_revision || 0, fill: '#f59e0b' },
        { name: '2+ возврата', value: entity.revisions?.multiple_revisions || 0, fill: '#ef4444' }
      ].filter(d => d.value > 0); // Прячем пустые сегменты

      return (
        <div className="flex flex-col h-full">
          <div className="flex justify-between items-center mb-6 bg-blue-50 p-4 rounded-xl">
            <div>
              <h4 className="font-bold text-blue-900 text-lg">{entity.name}</h4>
              <p className="text-sm text-blue-700 mt-1">Детальный профиль продуктивности (Индекс: 0-100%)</p>
            </div>
            <div className="text-right flex gap-3">
              <div className="bg-white px-3 py-1 rounded-lg border border-blue-200 text-blue-800 text-xs text-center">
                <span className="block font-bold">Успех 1-го раза</span>
                {entity.revisions?.first_time_success_rate}%
              </div>
              <span className="bg-blue-600 text-white px-3 py-1 rounded-lg font-bold flex items-center">
                ★ {entity.quality} / 5.0
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-[300px]">
            
            {/* 1. Воронка */}
            <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex flex-col justify-center">
              <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center mb-2">Воронка задач</h5>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={funnelData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#555', fontWeight: 'bold' }} width={80} />
                  <ChartTooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px' }} />
                  <Bar dataKey="value" name="Задач" radius={[0, 4, 4, 0]} barSize={15} label={{ position: 'right', fill: '#888' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 2. Круговая диаграмма доработок (НОВОЕ) */}
            <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex flex-col justify-center items-center">
              <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center mb-2">Частота доработок</h5>
              {revisionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={revisionData}
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {revisionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">Нет данных о доработках</div>
              )}
              {/* Легенда */}
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {revisionData.map((entry, i) => (
                  <div key={i} className="flex items-center gap-1 text-[10px] text-gray-600">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.fill }}></div>
                    {entry.name} ({entry.value})
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Радар */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-4 shadow-sm flex flex-col justify-center">
              <h5 className="text-xs font-bold text-indigo-400 uppercase tracking-wider text-center mb-2">Комплексный профиль</h5>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="#c7d2fe" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#4f46e5', fontSize: 10, fontWeight: 'bold' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Рейтинг (%)" dataKey="A" stroke="#4f46e5" strokeWidth={2} fill="#6366f1" fillOpacity={0.5} />
                  <ChartTooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            
          </div>
        </div>
      );
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-10 space-y-6">
      
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col md:flex-row justify-between items-center md:items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            С возвращением, {currentUser.first_name || currentUser.username}!
          </h1>
          <p className="text-gray-500 mt-2 text-lg">
            Панель управления {analytics?.scope === 'institute' ? 'институтом' : 'кафедрой'}
          </p>
        </div>
      </div>

      {isAdmin && analytics ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-sm font-bold text-gray-500 mb-1 uppercase tracking-wider">Качество работ</p>
              <p className="text-4xl font-black text-blue-600">{analytics.kpi.avg_quality} <span className="text-lg text-gray-400">/ 5.0</span></p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-sm font-bold text-gray-500 mb-1 uppercase tracking-wider">Выполнение в срок</p>
              <p className="text-4xl font-black text-green-600">{analytics.kpi.completion_rate}%</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-sm font-bold text-gray-500 mb-1 uppercase tracking-wider">Опоздания (сегодня)</p>
              <p className="text-4xl font-black text-yellow-500">{analytics.kpi.late} <span className="text-lg text-gray-400">чел.</span></p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-sm font-bold text-gray-500 mb-1 uppercase tracking-wider">Штат онлайн</p>
              <p className="text-4xl font-black text-purple-600">{analytics.kpi.on_time} <span className="text-lg text-gray-400">/ {analytics.kpi.total_staff}</span></p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 border-b border-gray-100 pb-4">
              <h3 className="font-bold text-gray-800 text-xl">Центр продуктивности</h3>
              
              <div className="flex flex-wrap justify-end gap-2 max-w-2xl">
                {analytics.scope === 'institute' && (
                  <>
                    <button 
                      onClick={() => { setChartTarget('all_depts'); setSelectedId(''); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${chartTarget === 'all_depts' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      Кафедры
                    </button>
                    <button 
                      onClick={() => { setChartTarget('bottlenecks_depts'); setSelectedId(''); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${chartTarget === 'bottlenecks_depts' ? 'bg-yellow-500 text-white shadow-md' : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'}`}
                    >
                      ⏳ Задержки (Каф.)
                    </button>
                  </>
                )}
                
                <button 
                  onClick={() => { setChartTarget('all_emps'); setSelectedId(''); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${chartTarget === 'all_emps' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Сотрудники
                </button>

                <button 
                  onClick={() => { setChartTarget('bottlenecks_emps'); setSelectedId(''); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${chartTarget === 'bottlenecks_emps' ? 'bg-yellow-500 text-white shadow-md' : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'}`}
                >
                  ⏳ Задержки
                </button>

                {/* НОВАЯ КНОПКА: ДОРАБОТКИ */}
                <button 
                  onClick={() => { setChartTarget('revisions'); setSelectedId(''); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${chartTarget === 'revisions' ? 'bg-indigo-500 text-white shadow-md' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
                >
                  🔄 Доработки
                </button>

                <button 
                  onClick={() => { setChartTarget('burnout'); setSelectedId(''); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${chartTarget === 'burnout' ? 'bg-red-500 text-white shadow-md' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
                >
                  🔥 Выгорание
                </button>

                {analytics.scope === 'institute' && (
                  <select 
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold outline-none cursor-pointer border ${chartTarget === 'all_emps_in_dept' ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-gray-50 border-gray-200 text-gray-700'}`}
                    value={chartTarget === 'all_emps_in_dept' ? selectedId : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedId(e.target.value);
                        setChartTarget('all_emps_in_dept');
                      }
                    }}
                  >
                    <option value="">Сотрудники кафедры...</option>
                    {analytics.departments.map(d => (
                      <option key={`dept-${d.id}`} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                )}

                <select 
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold outline-none cursor-pointer border ${chartTarget === 'single' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-700'}`}
                  value={chartTarget === 'single' ? selectedId : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedId(e.target.value);
                      setChartTarget('single');
                    }
                  }}
                >
                  <option value="">Детально по сотруднику...</option>
                  {analytics.employees.map(e => (
                    <option key={`emp-${e.id}`} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="w-full">
              {renderProductivityChart()}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-6">
            <div className="p-6 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-800 text-lg">Общий рейтинг сотрудников</h3>
            </div>
            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-left border-collapse">
                <thead className="bg-white sticky top-0 shadow-sm z-10">
                  <tr>
                    <th className="py-3 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">Сотрудник</th>
                    {analytics.scope === 'institute' && <th className="py-3 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">Кафедра</th>}
                    <th className="py-3 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 text-center">Задачи (Готово / Всего)</th>
                    <th className="py-3 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 text-center">Качество</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {analytics.employees.map(emp => (
                    <tr key={emp.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-4 px-6"><Link to={`/profile/${emp.id}`} className="font-bold text-gray-800 hover:text-blue-600 transition">{emp.name}</Link></td>
                      {analytics.scope === 'institute' && <td className="py-4 px-6 text-sm text-gray-600">{analytics.departments.find(d => d.id === emp.department_id)?.name || 'Нет'}</td>}
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="font-bold text-gray-800">{emp.completed}</span>
                          <span className="text-gray-400">/</span>
                          <span className="text-gray-500">{emp.total}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`font-bold px-2.5 py-1 rounded-lg text-sm ${emp.quality >= 4.5 ? 'bg-green-100 text-green-700' : emp.quality >= 3.5 ? 'bg-yellow-100 text-yellow-700' : emp.quality > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                          {emp.quality > 0 ? `★ ${emp.quality}` : 'Нет'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Добро пожаловать в рабочее пространство!</h2>
          <p className="text-gray-500">У вас нет прав администратора для просмотра глобальной аналитики.</p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col mt-6">
        <div className="p-6 border-b border-gray-100 bg-gray-50">
          <h3 className="font-bold text-gray-800 text-lg">Ваши горящие задачи</h3>
        </div>
        <div className="p-6 overflow-x-auto flex gap-4">
          {myActiveTasks.length > 0 ? myActiveTasks.map(task => (
            <Link key={task.id} to={`/tasks/${task.id}`} className="min-w-[280px] p-5 border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-md transition">
              <h4 className="font-bold text-gray-800 mb-2 line-clamp-1">{task.title}</h4>
            </Link>
          )) : <div className="text-gray-400 py-6 w-full text-center">Нет горящих задач</div>}
        </div>
      </div>
    </div>
  );
}