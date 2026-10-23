import { useState, useEffect } from 'react';
import api from '../api';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next'; 

export default function Departments() {
  const { t, i18n } = useTranslation(); 
  const [searchParams] = useSearchParams();
  const deptParam = searchParams.get('dept');

  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedDeptId, setSelectedDeptId] = useState(null);
  const [loading, setLoading] = useState(true);

  const dateLocale = i18n.language === 'en' ? 'en-US' : i18n.language === 'tk' ? 'tk-TM' : 'ru-RU';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [meRes, depsRes, usersRes] = await Promise.all([
          api.get('/users/me/'),
          api.get('/departments/').catch(() => ({ data: [] })),
          api.get('/users/')
        ]);
        
        setCurrentUser(meRes.data);
        setDepartments(depsRes.data);
        setUsers(usersRes.data);

        if (deptParam) {
          setSelectedDeptId(Number(deptParam));
        } else if (meRes.data.department) {
          setSelectedDeptId(meRes.data.department);
        } else if (depsRes.data.length > 0) {
          setSelectedDeptId(depsRes.data[0].id);
        }
      } catch (error) {
        console.error('Ошибка загрузки данных', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [deptParam]);

  if (loading) return <div className="p-8 text-center text-gray-500 flex items-center justify-center h-full">{t('departments.loading')}</div>;

  const currentDeptUsers = users.filter(u => u.department === selectedDeptId);
  const selectedDeptInfo = departments.find(d => d.id === selectedDeptId);

  const canViewPersonnelFile = (employee) => {
    if (!currentUser) return false;
    if (currentUser.id === employee.id) return true;
    if (currentUser.is_rectorate || ['dean', 'deputy_dean'].includes(currentUser.position)) return true;
    if (currentUser.position === 'head_of_department' && currentUser.department === employee.department) return true;
    return false;
  };

  // ЭКСПОРТ СПИСКА СОТРУДНИКОВ КАФЕДРЫ В EXCEL (CSV С UTF-8 BOM)
  const handleExportStaffCSV = () => {
    if (currentDeptUsers.length === 0) return;

    const escapeCSV = (val) => {
      const str = String(val ?? '');
      return `"${str.replace(/"/g, '""')}"`;
    };

    const headers = [
      t('departments.csv_headers.full_name'),
      t('departments.csv_headers.department'),
      t('departments.csv_headers.position'),
      t('departments.csv_headers.degree'),
      t('departments.csv_headers.work_status'),
      t('departments.csv_headers.email'),
      t('departments.csv_headers.phone'),
      t('departments.csv_headers.hours'),
      t('departments.csv_headers.hired')
    ];

    const rows = [headers.map(escapeCSV).join(';')];

    currentDeptUsers.forEach((emp) => {
      const roleText =
        emp.position && emp.position !== 'none'
          ? t(`profile.positions.${emp.position}`, { defaultValue: emp.position_display })
          : t(`profile.teaching_statuses.${emp.teaching_status}`, {
              defaultValue: emp.teaching_status_display || t('profile.teacher')
            });

      const degreeText =
        emp.academic_degree && emp.academic_degree !== 'none'
          ? t(`profile.academic_degrees.${emp.academic_degree}`, {
              defaultValue: emp.academic_degree_display
            })
          : t('profile.academic_degrees.none');

      const statusText = t(`profile.work_statuses.${emp.work_status}`, {
        defaultValue: emp.work_status_display || t('departments.card.working')
      });

      const hiredText = emp.employment_date
        ? new Date(emp.employment_date).toLocaleDateString(dateLocale)
        : t('departments.card.none');

      const row = [
        `${emp.last_name} ${emp.first_name}`.trim(),
        selectedDeptInfo ? selectedDeptInfo.name : emp.department_name || '',
        roleText,
        degreeText,
        statusText,
        emp.email || t('departments.card.none'),
        emp.phone || t('departments.card.none'),
        emp.working_hours || '',
        hiredText
      ];

      rows.push(row.map(escapeCSV).join(';'));
    });

    const csvContent = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeDeptName = selectedDeptInfo ? selectedDeptInfo.name.replace(/\s+/g, '_') : 'department';
    link.setAttribute('download', `staff_${safeDeptName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col md:flex-row gap-6 pb-6">
      
      <div className="w-full md:w-1/3 lg:w-1/4 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-full">
        <div className="p-5 border-b border-gray-100 bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800">{t('departments.structure')}</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {departments.length > 0 ? departments.map(dept => (
            <button
              key={dept.id}
              onClick={() => setSelectedDeptId(dept.id)}
              className={`w-full text-left px-4 py-3 rounded-xl transition-all font-medium ${
                selectedDeptId === dept.id 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
              }`}
            >
              {dept.name}
            </button>
          )) : (
            <p className="text-center text-gray-500 mt-4 text-sm">{t('departments.not_found')}</p>
          )}
        </div>
      </div>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              {selectedDeptInfo ? selectedDeptInfo.name : t('departments.select_dept')}
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              {t('departments.staff_count')} <span className="font-bold text-blue-600">{currentDeptUsers.length}</span>
            </p>
          </div>

          {/* КНОПКА ВЫГРУЗКИ СОТРУДНИКОВ КАФЕДРЫ В EXCEL */}
          {currentDeptUsers.length > 0 && (
            <button
              onClick={handleExportStaffCSV}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>{t('departments.export_csv')}</span>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          {currentDeptUsers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {currentDeptUsers.map(employee => (
                <div key={employee.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-all flex flex-col">
                  
                  <div className="p-5 border-b border-gray-100 flex items-start space-x-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-full flex items-center justify-center text-xl font-bold shadow-md shrink-0">
                      {employee.first_name ? employee.first_name[0] : employee.username[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-800 text-lg leading-tight truncate" title={`${employee.last_name} ${employee.first_name}`}>
                        {employee.last_name} <br/> {employee.first_name}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="inline-block bg-blue-50 text-blue-700 border border-blue-100 text-[10px] uppercase font-bold px-2 py-0.5 rounded">
                          {employee.position && employee.position !== 'none'
                            ? t(`profile.positions.${employee.position}`, { defaultValue: employee.position_display }) 
                            : t(`profile.teaching_statuses.${employee.teaching_status}`, { defaultValue: employee.teaching_status_display || t('profile.teacher') })}
                        </span>
                        {employee.academic_degree && employee.academic_degree !== 'none' && (
                          <span className="inline-block bg-purple-50 text-purple-700 border border-purple-100 text-[10px] uppercase font-bold px-2 py-0.5 rounded">
                            {t(`profile.academic_degrees.${employee.academic_degree}`, { defaultValue: employee.academic_degree_display })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-5 flex-1 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">{t('departments.card.status')}</span>
                      <span className={`font-semibold ${
                          employee.work_status === 'working' ? 'text-green-600' : 'text-orange-500'
                      }`}>
                          {t(`profile.work_statuses.${employee.work_status}`, { defaultValue: employee.work_status_display || t('departments.card.working') })}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">{t('departments.card.email')}</span>
                      <span className="text-gray-800 font-medium truncate ml-2" title={employee.email}>
                        {employee.email || t('departments.card.none')}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">{t('departments.card.phone')}</span>
                      <span className="text-gray-800 font-medium">{employee.phone || t('departments.card.none')}</span>
                    </div>
                    
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">{t('departments.card.hours')}</span>
                      <span className="text-gray-800 bg-gray-100 px-2 py-0.5 rounded font-medium">{employee.working_hours}</span>
                    </div>

                    {employee.employment_date && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">{t('departments.card.hired')}</span>
                        <span className="text-gray-800 font-medium">{new Date(employee.employment_date).toLocaleDateString(dateLocale)}</span>
                      </div>
                    )}
                  </div>

                  {canViewPersonnelFile(employee) && (
                    <div className="p-4 bg-gray-50 border-t border-gray-100">
                      <Link 
                        to={`/profile/${employee.id}`} 
                        className="flex items-center justify-center w-full py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 transition-colors shadow-sm"
                      >
                        {t('departments.view_profile')} &rarr;
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <p className="text-lg">{t('departments.empty_staff')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}