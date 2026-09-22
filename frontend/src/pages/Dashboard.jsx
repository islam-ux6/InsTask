import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useTranslation } from 'react-i18next'; // ПОДКЛЮЧЕНО
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer,
  Line, ComposedChart, Cell, ReferenceLine,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie
} from 'recharts';

export default function Dashboard() {
  const { t } = useTranslation(); // ИНИЦИАЛИЗАЦИЯ ПЕРЕВОДЧИКА
  
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
        } else if (data?.scope === 'personal') {
          setChartTarget('single');
          setSelectedId(String(user.id));
        }

        const myTasks = tasksRes.data.filter(task => 
          task.assignees.some(a => a.id === user.id) && task.status !== 'completed'
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

  if (loading) return <div className="min-h-[calc(100vh-6rem)] flex items-center justify-center text-gray-500">...</div>;
  if (!currentUser) return null;

  const isAdmin = currentUser.is_rectorate || currentUser.is_manager;

  const renderProductivityChart = () => {
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
            <Bar yAxisId="left" dataKey="completion_rate" name={t('dashboard.charts.completed_on_time')} fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
            <Line yAxisId="right" type="monotone" dataKey="quality" name={t('dashboard.charts.average_quality')} stroke="#8b5cf6" strokeWidth={3} dot={{ r: 5 }} />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

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
            <Bar yAxisId="left" dataKey="completion_rate" name={t('dashboard.charts.task_completion')} fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Line yAxisId="right" type="monotone" dataKey="quality" name={t('dashboard.charts.quality')} stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

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
            <h4 className="font-bold text-gray-700">{t('dashboard.charts.where_stuck')}</h4>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888' }} interval={0} angle={isDept ? 0 : -30} textAnchor={isDept ? "middle" : "end"} height={60} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
              <ChartTooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="in_progress" name={t('dashboard.charts.in_progress_hours')} stackId="a" fill="#3b82f6" maxBarSize={40} />
              <Bar dataKey="on_review" name={t('dashboard.charts.on_review_hours')} stackId="a" fill="#f59e0b" maxBarSize={40} />
              <Bar dataKey="revision" name={t('dashboard.charts.revision_hours')} stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (chartTarget === 'burnout') {
      const burnoutData = analytics.employees.map(emp => {
        const active = emp.statuses.created + emp.statuses.in_progress + emp.statuses.revision;
        return { ...emp, active_tasks: active };
      }).sort((a, b) => b.active_tasks - a.active_tasks);

      const calcAvg = burnoutData.length ? (burnoutData.reduce((s, e) => s + e.active_tasks, 0) / burnoutData.length) : 0;
      const avgActive = Math.max(calcAvg, 3);
      
      return (
        <div className="flex flex-col h-full">
          <div className="mb-4 text-center">
            <h4 className="font-bold text-red-700">{t('dashboard.charts.burnout_risk')}</h4>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={burnoutData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#888' }} interval={0} angle={-30} textAnchor="end" height={60} />
              <YAxis axisLine={false} tickLine={false} />
              <ChartTooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px' }} />
              <ReferenceLine y={avgActive} stroke="#f59e0b" strokeDasharray="3 3" />
              <Bar dataKey="active_tasks" name={t('dashboard.charts.active_tasks')} radius={[4, 4, 0, 0]} maxBarSize={40}>
                {burnoutData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.active_tasks >= avgActive * 1.5 ? '#ef4444' : entry.active_tasks > avgActive ? '#f59e0b' : '#10b981'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (chartTarget === 'revisions') {
      const filteredEmps = analytics.employees.filter(e => e.revisions.total_evaluated > 0);
      return (
        <div className="flex flex-col h-full">
          <div className="mb-4 text-center">
            <h4 className="font-bold text-indigo-700">{t('dashboard.charts.revisions_freq')}</h4>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={filteredEmps} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
              <XAxis type="number" axisLine={false} tickLine={false} hide />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#555', fontWeight: 'bold' }} width={90} />
              <ChartTooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="revisions.zero_revisions" name={t('dashboard.charts.first_try')} stackId="a" fill="#10b981" />
              <Bar dataKey="revisions.one_revision" name={t('dashboard.charts.one_revision')} stackId="a" fill="#f59e0b" />
              <Bar dataKey="revisions.multiple_revisions" name={t('dashboard.charts.multiple_revisions')} stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (chartTarget === 'single') {
      let entity = analytics.employees.find(e => e.id === parseInt(selectedId));
      if (!entity) return <div className="text-center text-gray-400 mt-20">{t('dashboard.charts.select_employee_prompt')}</div>;

      const funnelData = [
        { name: t('dashboard.charts.funnel.created'), value: entity.statuses.created, fill: '#9ca3af' },
        { name: t('dashboard.charts.funnel.in_progress'), value: entity.statuses.in_progress, fill: '#3b82f6' },
        { name: t('dashboard.charts.funnel.revision'), value: entity.statuses.revision, fill: '#ef4444' },
        { name: t('dashboard.charts.funnel.on_review'), value: entity.statuses.on_review, fill: '#f59e0b' },
        { name: t('dashboard.charts.funnel.completed'), value: entity.statuses.completed, fill: '#10b981' }
      ];

      const radarData = [
        { subject: t('dashboard.charts.radar.quality'), A: entity.radar?.quality || 0, fullMark: 100 },
        { subject: t('dashboard.charts.radar.discipline'), A: entity.radar?.discipline || 0, fullMark: 100 },
        { subject: t('dashboard.charts.radar.autonomy'), A: entity.radar?.autonomy || 0, fullMark: 100 },
        { subject: t('dashboard.charts.radar.speed'), A: entity.radar?.speed || 0, fullMark: 100 },
        { subject: t('dashboard.charts.radar.volume'), A: entity.radar?.volume || 0, fullMark: 100 },
      ];

      const revisionData = [
        { name: t('dashboard.charts.first_try'), value: entity.revisions?.zero_revisions || 0, fill: '#10b981' },
        { name: t('dashboard.charts.one_revision'), value: entity.revisions?.one_revision || 0, fill: '#f59e0b' },
        { name: t('dashboard.charts.multiple_revisions'), value: entity.revisions?.multiple_revisions || 0, fill: '#ef4444' }
      ].filter(d => d.value > 0);

      return (
        <div className="flex flex-col h-full">
          <div className="flex justify-between items-center mb-6 bg-blue-50 p-4 rounded-xl">
            <div>
              <h4 className="font-bold text-blue-900 text-lg">{entity.name}</h4>
              <p className="text-sm text-blue-700 mt-1">{t('dashboard.charts.detailed_profile')}</p>
            </div>
            <div className="text-right flex gap-3">
              <span className="bg-blue-600 text-white px-3 py-1 rounded-lg font-bold flex items-center">
                ★ {entity.quality} / 5.0
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-[300px]">
            <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex flex-col justify-center">
              <h5 className="text-xs font-bold text-gray-400 uppercase text-center mb-2">{t('dashboard.charts.task_funnel')}</h5>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={funnelData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} width={80} />
                  <ChartTooltip cursor={{ fill: '#f9fafb' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={15} label={{ position: 'right', fill: '#888' }} fill="#3b82f6"/>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex flex-col justify-center items-center">
              <h5 className="text-xs font-bold text-gray-400 uppercase text-center mb-2">{t('dashboard.charts.revisions_freq')}</h5>
              {revisionData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={revisionData} innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                      {revisionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">{t('dashboard.charts.no_data')}</div>
              )}
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-4 shadow-sm flex flex-col justify-center">
              <h5 className="text-xs font-bold text-indigo-400 uppercase text-center mb-2">{t('dashboard.charts.radar.title')}</h5>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                  <PolarGrid stroke="#c7d2fe" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#4f46e5', fontSize: 10, fontWeight: 'bold' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="A" stroke="#4f46e5" strokeWidth={2} fill="#6366f1" fillOpacity={0.5} />
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
            {t('dashboard.welcome')}, {currentUser.first_name || currentUser.username}!
          </h1>
          <p className="text-gray-500 mt-2 text-lg">
            {analytics?.scope === 'institute' ? t('dashboard.panel_institute') : (analytics?.scope === 'department' ? t('dashboard.panel_department') : t('dashboard.panel_teacher'))}
          </p>
        </div>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${isAdmin ? 'lg:grid-cols-4' : ''} gap-6`}>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-sm font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('dashboard.your_quality')}</p>
          <p className="text-4xl font-black text-blue-600">{analytics?.kpi.avg_quality} <span className="text-lg text-gray-400">/ 5.0</span></p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-sm font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('dashboard.completion_rate')}</p>
          <p className="text-4xl font-black text-green-600">{analytics?.kpi.completion_rate}%</p>
        </div>
        {isAdmin && (
          <>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-sm font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('dashboard.lates_today')}</p>
              <p className="text-4xl font-black text-yellow-500">{analytics?.kpi.late} <span className="text-lg text-gray-400">{t('dashboard.people')}</span></p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-sm font-bold text-gray-500 mb-1 uppercase tracking-wider">{t('dashboard.staff_online')}</p>
              <p className="text-4xl font-black text-purple-600">{analytics?.kpi.on_time} <span className="text-lg text-gray-400">/ {analytics?.kpi.total_staff}</span></p>
            </div>
          </>
        )}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col xl:flex-row justify-between items-center mb-8 gap-4 border-b border-gray-100 pb-4">
          <h3 className="font-bold text-gray-800 text-xl">{isAdmin ? t('dashboard.productivity_center') : t('dashboard.personal_productivity')}</h3>
          
          {isAdmin && (
            <div className="flex flex-wrap justify-end gap-2 max-w-4xl">
              {analytics?.scope === 'institute' && (
                <>
                  <button onClick={() => { setChartTarget('all_depts'); setSelectedId(''); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${chartTarget === 'all_depts' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{t('dashboard.filters.departments')}</button>
                  <button onClick={() => { setChartTarget('bottlenecks_depts'); setSelectedId(''); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${chartTarget === 'bottlenecks_depts' ? 'bg-yellow-500 text-white' : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'}`}>{t('dashboard.filters.delays_dept')}</button>
                </>
              )}
              
              <button onClick={() => { setChartTarget('all_emps'); setSelectedId(''); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${chartTarget === 'all_emps' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{t('dashboard.filters.employees')}</button>
              <button onClick={() => { setChartTarget('bottlenecks_emps'); setSelectedId(''); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${chartTarget === 'bottlenecks_emps' ? 'bg-yellow-500 text-white' : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'}`}>{t('dashboard.filters.delays_emp')}</button>
              <button onClick={() => { setChartTarget('revisions'); setSelectedId(''); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${chartTarget === 'revisions' ? 'bg-indigo-500 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}>{t('dashboard.filters.revisions')}</button>
              <button onClick={() => { setChartTarget('burnout'); setSelectedId(''); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${chartTarget === 'burnout' ? 'bg-red-500 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}>{t('dashboard.filters.burnout')}</button>

              {analytics?.scope === 'institute' && (
                <select 
                  className="px-3 py-1.5 rounded-lg text-xs font-bold outline-none cursor-pointer border bg-gray-50 border-gray-200" 
                  value={chartTarget === 'all_emps_in_dept' ? selectedId : ''} 
                  onChange={(e) => { 
                    if (e.target.value) { setSelectedId(e.target.value); setChartTarget('all_emps_in_dept'); } 
                    else { setChartTarget('all_depts'); setSelectedId(''); }
                  }}
                >
                  <option value="">{t('dashboard.filters.select_dept')}</option>
                  {analytics.departments.map(d => <option key={`dept-${d.id}`} value={d.id}>{d.name}</option>)}
                </select>
              )}

              <select 
                className="px-3 py-1.5 rounded-lg text-xs font-bold outline-none cursor-pointer border bg-gray-50 border-gray-200" 
                value={chartTarget === 'single' ? selectedId : ''} 
                onChange={(e) => { if (e.target.value) { setSelectedId(e.target.value); setChartTarget('single'); } }}
              >
                <option value="">{t('dashboard.filters.select_emp')}</option>
                {analytics?.employees.map(e => <option key={`emp-${e.id}`} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="w-full">
          {renderProductivityChart()}
        </div>
      </div>
    </div>
  );
}