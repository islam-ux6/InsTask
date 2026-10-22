import os
import django
import random
import time
from datetime import timedelta
from django.utils import timezone
from django.db import IntegrityError

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings") 
django.setup()

from accounts.models import User, EmployeeRecord, DailyAttendance, ScheduleItem
from departments.models import Department
from tasks.models import Task, TaskStatusLog, TaskReport

def run_seed():
    print("🧹 Köne maglumatlar arassalanýar (Очистка старых данных)...")
    
    # Жесткая очистка зависимых таблиц (задачи, посещаемость, расписание)
    TaskReport.objects.all().delete()
    TaskStatusLog.objects.all().delete()
    Task.objects.all().delete()
    DailyAttendance.objects.all().delete()
    EmployeeRecord.objects.all().delete()
    ScheduleItem.objects.all().delete()
    
    # Удаляем только пользователей, сгенерированных этим скриптом
    User.objects.filter(username__endswith='_demo').delete()
    # Удаляем нашу тестовую кафедру
    Department.objects.filter(name="Kompýuter ylymlary").delete()

    print("⏳ Baza hakyky maglumatlar bilen doldurylýar (Создание структуры)...")

    # 1. СОЗДАЕМ ОДНУ КАФЕДРУ
    dept_cs = Department.objects.create(name="Kompýuter ylymlary")

    # 2. СОЗДАЕМ ДИРЕКТОРА/ДЕКАНА (Без кафедры, он будет ставить задачи)
    dean = User.objects.create(
        username="dean_demo", first_name="Maral", last_name="Batyrowa", email="dean@edu.tm",
        position="dean", teaching_status="docent", academic_degree="candidate",
        work_status="working", working_hours="08:00-16:30", phone="+99365223344",
        employment_date=timezone.now().date() - timedelta(days=2000)
    )

    # 3. СОЗДАЕМ ЗАВЕДУЮЩЕГО И ПРЕПОДАВАТЕЛЕЙ ДЛЯ НАШЕЙ КАФЕДРЫ
    all_users = [dean]

    # Заведующий кафедрой
    head_user = User.objects.create(
        username="mergen_gurbanow_demo", first_name="Mergen", last_name="Gurbanow", email="mergen@edu.tm",
        position="head_of_department", teaching_status="docent", academic_degree="candidate", department=dept_cs,
        work_status="working", working_hours="08:00-16:30", phone="+99361112233",
        employment_date=timezone.now().date() - timedelta(days=1500)
    )
    all_users.append(head_user)
    dept_cs.head = head_user
    dept_cs.save()

    # Два преподавателя
    teachers_data = [
        ("Aýgül", "Mämmedowa", "aygul", "senior_teacher", "none"),
        ("Serdar", "Orazow", "serdar", "teacher", "none")
    ]
    
    for tf, tl, tun, tts, tdeg in teachers_data:
        teacher_user = User.objects.create(
            username=f"{tun}_demo", first_name=tf, last_name=tl, email=f"{tun}@edu.tm",
            position="none", teaching_status=tts, academic_degree=tdeg, department=dept_cs,
            work_status="working", working_hours="08:00-15:00", phone=f"+9936{random.randint(100000, 999999)}",
            employment_date=timezone.now().date() - timedelta(days=random.randint(100, 1000))
        )
        all_users.append(teacher_user)
        
        # 4. РАСПИСАНИЕ ПРЕПОДАВАТЕЛЕЙ КАФЕДРЫ
        subjects = ["C++ Programmirleme", "Algoritmler we maglumat düzümleri", "Kompýuter arhitekturasy"]
        for _ in range(5): # По 5 пар каждому преподавателю
            ScheduleItem.objects.create(
                user=teacher_user,
                week_type=random.choice(['odd', 'even', 'both']),
                day_of_week=random.choice(['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница']),
                time_slot=random.choice(['08:30 - 10:00', '10:15 - 11:45', '12:00 - 13:30', '14:00 - 15:30']),
                subject_name=random.choice(subjects),
                class_type=random.choice(["Leksiýa", "Amaly", "Tejribe"]),
                room=random.choice(["A-101", "B-205", "Lab-1"]),
                group=random.choice(["IT-11", "IT-12", "CS-21"])
            )

    print("✅ Kafedra, işgärler we sapak tertibi (Расписание) goşuldy.")

    # 5. ЗАДАЧИ ВНУТРИ КАФЕДРЫ
    teachers = [u for u in all_users if u.position == 'none']
    
    tasks_data = [
        # Декан ставит задачу Заведующему
        {"title": "Güzgülik synaglarynyň tertibini düzmek", "desc": "Barlaglaryň möhletlerini we otaglary bellemeli.", "creator": dean, "assignee": head_user},
        
        # Заведующий ставит задачи преподавателям
        {"title": "Açyk sapak geçirmek", "desc": "Täze tehnologiýalary ulanmak bilen görkezme sapagyny guramaly.", "creator": head_user, "assignee": teachers[0]},
        {"title": "Ylmy makala taýýarlamak", "desc": "Halkara žurnal üçin ylmy-derňew işini ýazmaly.", "creator": head_user, "assignee": teachers[1]},
        {"title": "Talyplaryň diplom işlerini barlamak", "desc": "Uçurymlaryň işlerini seljermeli we baha goýmaly.", "creator": head_user, "assignee": random.choice(teachers)},
    ]

    for t_data in tasks_data:
        # Для каждой логической задачи создаем 2-3 копии в разных статусах
        for _ in range(random.randint(2, 3)):
            deadline = timezone.now() + timedelta(days=random.randint(-2, 10))
            status = random.choice(['created', 'in_progress', 'on_review', 'revision', 'completed'])
            
            task = Task.objects.create(
                title=t_data["title"],
                description=t_data["desc"],
                creator=t_data["creator"],
                deadline=deadline,
                status=status,
                quality_score=random.randint(4, 5) if status == 'completed' else None,
                revision_count=random.randint(0, 2) if status in ['revision', 'completed'] else 0
            )
            task.assignees.add(t_data["assignee"])

            # Логи для таймлайна (чтобы графики красиво отображались)
            if status != 'created':
                t1 = task.created_at
                t2 = t1 + timedelta(hours=random.randint(2, 10))
                TaskStatusLog.objects.create(task=task, status='created', entered_at=t1, exited_at=t2)
                
                if status == 'in_progress':
                    TaskStatusLog.objects.create(task=task, status='in_progress', entered_at=t2)
                else:
                    t3 = t2 + timedelta(hours=random.randint(10, 48))
                    TaskStatusLog.objects.create(task=task, status='in_progress', entered_at=t2, exited_at=t3)
                    
                    if status == 'on_review':
                        TaskStatusLog.objects.create(task=task, status='on_review', entered_at=t3)
                        TaskReport.objects.create(task=task, author=t_data["assignee"], comment="Tabşyryk ýerine ýetirildi. Barlamagyňyzy haýyş edýärin.")
                    elif status == 'completed':
                        t4 = t3 + timedelta(hours=random.randint(1, 5))
                        TaskStatusLog.objects.create(task=task, status='on_review', entered_at=t3, exited_at=t4)
                        task.completed_at = t4
                        task.save()
                        TaskReport.objects.create(task=task, author=t_data["assignee"], comment="Iş doly tamamlandy we tabşyryldy.")

    print("✅ Hakyky tabşyryklar (Задачи) döredildi.")

    # 6. ПОСЕЩАЕМОСТЬ И ЛИЧНЫЕ ДЕЛА (Дисциплина)
    for user in all_users:
        for day in range(14): 
            date = timezone.now().date() - timedelta(days=day)
            if date.weekday() == 6:  continue
                
            is_late = random.random() < 0.15
            arr_time = timezone.now().replace(hour=8, minute=random.randint(35, 59) if is_late else random.randint(0, 25))
            
            try:
                DailyAttendance.objects.create(user=user, date=date, status='late' if is_late else 'on_time', arrival_time=arr_time.time())
            except IntegrityError: pass

        if user.position == 'none':
            if random.random() < 0.4:
                EmployeeRecord.objects.create(
                    user=user, record_type='reward', description="Ylmy makala çap edendigi üçin minnetdarlyk.", author=head_user
                )

    print("✅ Gatnaşyk (Посещаемость) we Şahsy jilt (Личные дела) dolduryldy.")
    print("🚀 Baza doly taýýar! Gowy işläň!")

if __name__ == "__main__":
    run_seed()