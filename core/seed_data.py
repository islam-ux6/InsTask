import os
import django
import random
from datetime import timedelta, time as dt_time
from django.utils import timezone
from django.db import IntegrityError
from django.contrib.auth.hashers import make_password

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from accounts.models import User, EmployeeRecord, DailyAttendance, ScheduleItem
from departments.models import Department
from tasks.models import Task, TaskStatusLog, TaskReport


def run_seed():
    print("1/6 Очистка старых демонстрационных данных...")

    TaskReport.objects.all().delete()
    TaskStatusLog.objects.all().delete()
    Task.objects.all().delete()
    DailyAttendance.objects.all().delete()
    EmployeeRecord.objects.all().delete()
    ScheduleItem.objects.all().delete()

    User.objects.filter(username__endswith="_demo").delete()
    Department.objects.filter(
        name__in=[
            "Kompýuter ylymlary",
            "Maglumat ulgamlary we tehnologiýalary",
            "Kiberhowpsuzlyk",
            "Amaly matematika we emeli aň",
        ]
    ).delete()

    # Единый хеш пароля "12345" для быстрой генерации всех пользователей
    default_password = make_password("12345")
    now = timezone.now()
    today = timezone.localdate()

    print("2/6 Создание кафедр и руководства института...")

    # 1. СОЗДАЕМ 4 КАФЕДРЫ
    dept_cs = Department.objects.create(name="Kompýuter ylymlary")
    dept_is = Department.objects.create(name="Maglumat ulgamlary we tehnologiýalary")
    dept_cyber = Department.objects.create(name="Kiberhowpsuzlyk")
    dept_ai = Department.objects.create(name="Amaly matematika we emeli aň")

    all_depts = [dept_cs, dept_is, dept_cyber, dept_ai]

    # 2. СОЗДАЕМ РЕКТОРАТ И ДЕКАНАТ
    rector = User.objects.create(
        username="rector_demo",
        password=default_password,
        first_name="Arslan",
        last_name="Amanow",
        email="rector@edu.tm",
        phone="+99365100001",
        position="rector",
        teaching_status="professor",
        academic_degree="doctor",
        work_status="working",
        working_hours="08:00-17:00",
        employment_date=today - timedelta(days=3200),
    )

    prorector = User.objects.create(
        username="prorector_demo",
        password=default_password,
        first_name="Kerim",
        last_name="Çaryýew",
        email="prorector@edu.tm",
        phone="+99365100002",
        position="prorector",
        teaching_status="docent",
        academic_degree="candidate",
        work_status="working",
        working_hours="08:00-17:00",
        employment_date=today - timedelta(days=2600),
    )

    dean = User.objects.create(
        username="dean_demo",
        password=default_password,
        first_name="Maral",
        last_name="Batyrowa",
        email="dean@edu.tm",
        phone="+99365100003",
        position="dean",
        teaching_status="docent",
        academic_degree="candidate",
        work_status="working",
        working_hours="08:00-16:30",
        employment_date=today - timedelta(days=2100),
    )

    deputy_dean = User.objects.create(
        username="deputy_dean_demo",
        password=default_password,
        first_name="Dawut",
        last_name="Geldiýew",
        email="deputy.dean@edu.tm",
        phone="+99365100004",
        position="deputy_dean",
        teaching_status="senior_teacher",
        academic_degree="master",
        work_status="working",
        working_hours="08:00-16:30",
        employment_date=today - timedelta(days=1500),
    )

    all_users = [rector, prorector, dean, deputy_dean]
    heads_by_dept = {}
    teachers_by_dept = {d: [] for d in all_depts}

    # 3. ШТАТ КАФЕДР (Заведующие и преподаватели разных должностей и степеней)
    departments_blueprint = {
        dept_cs: {
            "head": ("mergen_gurbanow", "Mergen", "Gurbanow", "docent", "candidate"),
            "staff": [
                ("aygul_mammedowa", "Aýgül", "Mämmedowa", "professor", "doctor", "working"),
                ("serdar_orazow", "Serdar", "Orazow", "senior_teacher", "phd", "working"),
                ("guwanc_annayew", "Guwanç", "Annaýew", "teacher", "master", "working"),
                ("bahar_kuliyeva", "Bahar", "Kuliýewa", "assistant", "master", "vacation"),
                ("perman_allayew", "Perman", "Allaýew", "senior_lab", "none", "working"),
            ],
            "subjects": [
                "C++ Programmirleme",
                "Algoritmler we maglumat düzümleri",
                "Kompýuter arhitekturasy",
                "Operasion ulgamlar",
                "Python dilinde programmirleme",
            ],
            "groups": ["CS-11", "CS-21", "CS-31"],
            "rooms": ["A-101", "A-102", "Lab-1"],
        },
        dept_is: {
            "head": ("basim_nyyazow", "Bäşim", "Nyýazow", "docent", "candidate"),
            "staff": [
                ("jemal_atayewa", "Jemal", "Ataýewa", "docent", "candidate", "working"),
                ("azat_berdiyew", "Azat", "Berdiýew", "senior_teacher", "master", "working"),
                ("lale_rejepowa", "Läle", "Rejepowa", "teacher", "master", "working"),
                ("maksat_hojayew", "Maksat", "Hojaýew", "junior_teacher", "none", "trip"),
                ("selbi_nuryyewa", "Selbi", "Nuryýewa", "lab_assistant", "none", "working"),
            ],
            "subjects": [
                "Maglumat bazalary (PostgreSQL)",
                "Web-programmirleme (React & Django)",
                "Ulgamlaýyn derňew",
                "Korporatiw maglumat ulgamlary",
                "Bulut tehnologiýalary",
            ],
            "groups": ["IS-11", "IS-21", "IS-31"],
            "rooms": ["B-201", "B-204", "Lab-2"],
        },
        dept_cyber: {
            "head": ("gurbanguly_durdyyew", "Gurbanguly", "Durdyýew", "professor", "doctor"),
            "staff": [
                ("maya_saparowa", "Maýa", "Saparowa", "docent", "phd", "working"),
                ("myrat_meredow", "Myrat", "Meredow", "senior_teacher", "master", "working"),
                ("batyr_kakayew", "Batyr", "Kakaýew", "teacher", "master", "working"),
                ("aysoltan_taganowa", "Aýsoltan", "Taganowa", "assistant", "none", "sick"),
            ],
            "subjects": [
                "Kriptografiýa we şifrlemek",
                "Tor howpsuzlygy",
                "Maglumat goragynyň esaslary",
                "Kiberhüjümleri derňemek",
            ],
            "groups": ["CYB-11", "CYB-21", "CYB-31"],
            "rooms": ["C-301", "C-305", "SecLab-1"],
        },
        dept_ai: {
            "head": ("begenc_soltanow", "Begenç", "Soltanow", "docent", "phd"),
            "staff": [
                ("gulshat_ashyrowa", "Gülşat", "Aşyrowa", "professor", "doctor", "working"),
                ("rowshan_nepesow", "Röwşen", "Nepesow", "senior_teacher", "candidate", "working"),
                ("dildar_jumayewa", "Dildar", "Jumaýewa", "teacher", "master", "working"),
                ("nazar_halymow", "Nazar", "Halymow", "junior_teacher", "master", "working"),
            ],
            "subjects": [
                "Maşyn öwrenmesi (Machine Learning)",
                "Emeli neýron torlary",
                "Diskret matematika",
                "Ähtimallyklar nazaryýeti we statistika",
            ],
            "groups": ["AI-11", "AI-21", "AI-31"],
            "rooms": ["D-401", "D-402", "AI-Lab"],
        },
    }

    print("3/6 Добавление сотрудников кафедр и генерация расписания без накладок...")

    days_of_week = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"]
    time_slots = ["08:30 - 10:00", "10:15 - 11:45", "12:00 - 13:30", "14:00 - 15:30"]
    class_types = ["Leksiýa", "Amaly", "Tejribe"]

    phone_counter = 65200010

    for dept, cfg in departments_blueprint.items():
        # Создаем Заведующего кафедрой
        h_uname, h_first, h_last, h_ts, h_deg = cfg["head"]
        phone_counter += 1
        head_user = User.objects.create(
            username=f"{h_uname}_demo",
            password=default_password,
            first_name=h_first,
            last_name=h_last,
            email=f"{h_uname}@edu.tm",
            phone=f"+993{phone_counter}",
            position="head_of_department",
            teaching_status=h_ts,
            academic_degree=h_deg,
            department=dept,
            work_status="working",
            working_hours="08:00-16:30",
            employment_date=today - timedelta(days=random.randint(1200, 2400)),
        )
        dept.head = head_user
        dept.save()
        all_users.append(head_user)
        heads_by_dept[dept] = head_user

        # Создаем преподавателей и лаборантов кафедры
        for idx, (s_uname, s_first, s_last, s_ts, s_deg, s_wstatus) in enumerate(cfg["staff"]):
            phone_counter += 1
            emp = User.objects.create(
                username=f"{s_uname}_demo",
                password=default_password,
                first_name=s_first,
                last_name=s_last,
                email=f"{s_uname}@edu.tm",
                phone=f"+993{phone_counter}",
                position="none",
                teaching_status=s_ts,
                academic_degree=s_deg,
                department=dept,
                work_status=s_wstatus,
                working_hours="08:00-15:30",
                employment_date=today - timedelta(days=random.randint(180, 1400)),
            )
            all_users.append(emp)
            teachers_by_dept[dept].append(emp)

            # Генерируем расписание без пересечений аудиторий и групп
            for d_idx, day_name in enumerate(days_of_week):
                if (d_idx + idx) % 2 == 0:
                    slot = time_slots[(idx + d_idx) % len(time_slots)]
                    room = cfg["rooms"][idx % len(cfg["rooms"])]
                    group = cfg["groups"][(idx + d_idx) % len(cfg["groups"])]
                    subject = cfg["subjects"][(idx + d_idx) % len(cfg["subjects"])]
                    w_type = "both" if d_idx < 4 else ("odd" if idx % 2 == 0 else "even")

                    ScheduleItem.objects.create(
                        user=emp,
                        week_type=w_type,
                        day_of_week=day_name,
                        time_slot=slot,
                        subject_name=subject,
                        class_type=class_types[(idx + d_idx) % len(class_types)],
                        room=f"{room}-{idx + 1}",
                        group=group,
                    )

    print("4/6 Генерация задач, дерева подзадач, отчетов и логов времени...")

    def create_task_with_timeline(
        title,
        description,
        creator,
        assignees=None,
        target_depts=None,
        parent_task=None,
        status_val="created",
        days_offset=5,
        quality=None,
        revisions=0,
        report_text=None,
        revision_remark=None,
    ):
        created_time = now - timedelta(days=random.randint(4, 12), hours=random.randint(1, 8))
        deadline_time = now + timedelta(days=days_offset)

        task = Task.objects.create(
            title=title,
            description=description,
            creator=creator,
            parent_task=parent_task,
            status=status_val,
            deadline=deadline_time,
            quality_score=quality if status_val == "completed" else None,
            revision_count=revisions,
        )
        # Принудительно обновляем created_at (обход auto_now_add)
        Task.objects.filter(id=task.id).update(created_at=created_time)

        if assignees:
            task.assignees.set(assignees)
        if target_depts:
            task.target_departments.set(target_depts)

        # Удаляем возможные авто-логи и строим красивую историю для графиков
        TaskStatusLog.objects.filter(task=task).delete()

        t_cursor = created_time
        wait_hours = random.randint(2, 10)
        t_in_prog = t_cursor + timedelta(hours=wait_hours)

        if status_val == "created":
            log = TaskStatusLog.objects.create(task=task, status="created")
            TaskStatusLog.objects.filter(id=log.id).update(entered_at=t_cursor, exited_at=None)
        else:
            log1 = TaskStatusLog.objects.create(task=task, status="created")
            TaskStatusLog.objects.filter(id=log1.id).update(entered_at=t_cursor, exited_at=t_in_prog)

            work_hours = random.randint(12, 36)
            t_review = t_in_prog + timedelta(hours=work_hours)

            if status_val == "in_progress":
                log2 = TaskStatusLog.objects.create(task=task, status="in_progress")
                TaskStatusLog.objects.filter(id=log2.id).update(entered_at=t_in_prog, exited_at=None)
            else:
                log2 = TaskStatusLog.objects.create(task=task, status="in_progress")
                TaskStatusLog.objects.filter(id=log2.id).update(entered_at=t_in_prog, exited_at=t_review)

                rev_wait = random.randint(3, 14)
                t_after_review = t_review + timedelta(hours=rev_wait)

                if status_val == "on_review":
                    log3 = TaskStatusLog.objects.create(task=task, status="on_review")
                    TaskStatusLog.objects.filter(id=log3.id).update(entered_at=t_review, exited_at=None)
                elif status_val == "revision":
                    log3 = TaskStatusLog.objects.create(task=task, status="on_review")
                    TaskStatusLog.objects.filter(id=log3.id).update(entered_at=t_review, exited_at=t_after_review)

                    log4 = TaskStatusLog.objects.create(task=task, status="revision")
                    TaskStatusLog.objects.filter(id=log4.id).update(entered_at=t_after_review, exited_at=None)
                elif status_val == "completed":
                    log3 = TaskStatusLog.objects.create(task=task, status="on_review")
                    TaskStatusLog.objects.filter(id=log3.id).update(entered_at=t_review, exited_at=t_after_review)

                    if revisions > 0:
                        t_rev_done = t_after_review + timedelta(hours=random.randint(6, 18))
                        log_rev = TaskStatusLog.objects.create(task=task, status="revision")
                        TaskStatusLog.objects.filter(id=log_rev.id).update(
                            entered_at=t_after_review, exited_at=t_rev_done
                        )
                        t_after_review = t_rev_done

                    log_done = TaskStatusLog.objects.create(task=task, status="completed")
                    TaskStatusLog.objects.filter(id=log_done.id).update(
                        entered_at=t_after_review, exited_at=None
                    )
                    # Если задача выполнена в срок, ставим completed_at до дедлайна
                    comp_time = min(t_after_review, deadline_time - timedelta(hours=2))
                    Task.objects.filter(id=task.id).update(completed_at=comp_time)

        report_author = assignees[0] if assignees else heads_by_dept.get(target_depts[0], dean)

        if report_text:
            rep = TaskReport.objects.create(task=task, author=report_author, comment=report_text)
            TaskReport.objects.filter(id=rep.id).update(submitted_at=now - timedelta(hours=5))

        if revision_remark:
            rev_rep = TaskReport.objects.create(
                task=task, author=creator, comment=f"[REVISION] {revision_remark}"
            )
            TaskReport.objects.filter(id=rev_rep.id).update(submitted_at=now - timedelta(hours=2))

        return task

    # А) ГЛАВНЫЕ ЗАДАЧИ НА КАФЕДРЫ С ДЕРЕВОМ ПОДЗАДАЧ
    conf_task = create_task_with_timeline(
        title="Halkara ylmy-amaly maslahaty guramak we geçirmek",
        description="Institutda geçiriljek ýyllyk IT we Kiberhowpsuzlyk maslahaty üçin makalalary ýygnamak, seksiýalaryň tertibini düzmek we tanyşdyryşlary taýýarlamak.",
        creator=rector,
        assignees=[heads_by_dept[dept_cs]],
        target_depts=[dept_cs, dept_cyber],
        status_val="in_progress",
        days_offset=7,
        report_text="Kafedralar boýunça iş topary döredildi, makalalaryň 70% ýygnaldy.",
    )

    # Подзадачи к главной задаче (2 завершены, 1 в работе -> прогресс 67%)
    create_task_with_timeline(
        title="Maslahatyň maksatnamasyny we çykyşlaryň sanawyny taýýarlamak",
        description="Talyplaryň we mugallymlaryň çykyşlaryny seksiýalara bölmeli.",
        creator=heads_by_dept[dept_cs],
        assignees=[teachers_by_dept[dept_cs][0]],
        parent_task=conf_task,
        status_val="completed",
        days_offset=2,
        quality=5,
        report_text="Maksatnama doly düzüldi we dekanata iberildi.",
    )
    create_task_with_timeline(
        title="Myhmanlar üçin prezentasiýa weマルチмедиа enjamlaryny sazlamak",
        description="Mejlisler zalyndaky proyektorlary we ses ulgamyny barlamaly.",
        creator=heads_by_dept[dept_cs],
        assignees=[teachers_by_dept[dept_cs][4]],
        parent_task=conf_task,
        status_val="completed",
        days_offset=3,
        quality=5,
        report_text="Ähli enjamlar barlandy, işe taýýar.",
    )
    create_task_with_timeline(
        title="Makalalaryň ýygyndysyny (Sbornik) çapa taýýarlamak",
        description="Gelip gowşan tezisleri redaktirlemek we formatlamak.",
        creator=heads_by_dept[dept_cs],
        assignees=[teachers_by_dept[dept_cs][1], teachers_by_dept[dept_cs][2]],
        parent_task=conf_task,
        status_val="in_progress",
        days_offset=5,
        report_text="Makalalaryň 45-si barlandy, galanlary redaktirlenýär.",
    )

    # Вторая крупная задача с подзадачами (от Декана для кафедры Информационных систем)
    accred_task = create_task_with_timeline(
        title="Okuw meýilnamalaryny we sillabuslary sanly ulgama geçirmek",
        description="Ähli dersler boýunça okuw-usulyýet toplumlaryny PDF we elektron görnüşde ulgama ýüklemeli.",
        creator=dean,
        assignees=[heads_by_dept[dept_is]],
        target_depts=[dept_is],
        status_val="on_review",
        days_offset=4,
        report_text="Kafedranyň ähli dersleri boýunça sillabuslar täzelendi. Barlamagyňyzy haýyş edýärin.",
    )
    create_task_with_timeline(
        title="Maglumat bazalary we Web-programmirleme sillabuslaryny täzelemek",
        description="2-nji we 3-nji ýyl talyplar üçin amaly sapaklaryň sanawyny goşmaly.",
        creator=heads_by_dept[dept_is],
        assignees=[teachers_by_dept[dept_is][0]],
        parent_task=accred_task,
        status_val="completed",
        days_offset=1,
        quality=5,
    )
    create_task_with_timeline(
        title="1-nji ýyl talyplar üçin tejribe işleriniň gollanmasyny ýazmak",
        description="Täze okuw ýyly üçin 15 sany tejribe işiniň ýumuşlaryny taýýarlamaly.",
        creator=heads_by_dept[dept_is],
        assignees=[teachers_by_dept[dept_is][1]],
        parent_task=accred_task,
        status_val="completed",
        days_offset=2,
        quality=4,
    )

    # Б) ЗАДАЧИ ПО ВСЕМ КАФЕДРАМ И СОТРУДНИКАМ (в разных статусах)
    task_templates = [
        (
            "Güzgülik aralyk jemleýji synaglaryň sowalnamalaryny düzmek",
            "Her ders boýunça 30 sany test we 3 sany amaly ýumuş taýýarlamaly.",
        ),
        (
            "Açyk görkezme sapagyny geçirmek",
            "Innowasion okatmagyň usullaryny ulanyp, açyk leksiýa guramaly we teswirnama ýazmaly.",
        ),
        (
            "Talyplaryň ýyllyk we diplom işleriniň temalaryny tassyklamak",
            "Uçurymlar üçin aktual IT we AI temalaryny hödürlemeli.",
        ),
        (
            "Ylmy žurnal üçin makala taýýarlamak",
            "Kafedranyň ylmy-derňew ugry boýunça makala ýazyp tabşyrmaly.",
        ),
        (
            "Laboratoriýa kompýuterlerinde programma üpjünçiligini täzelemek",
            "IDE, Python, PostgreSQL we wirtual maşynlary gurnamaly.",
        ),
        (
            "Talyplar bilen terbiýeçilik we tertip-düzgün duşuşygyny geçirmek",
            "Gatnaşyk we içerki düzgün-nyzam boýunça söhbetdeşlik geçirmeli.",
        ),
    ]

    for dept in all_depts:
        head = heads_by_dept[dept]
        staff = teachers_by_dept[dept]

        # Задачи от Ректора / Проректора / Декана на саму кафедру (чтобы графики кафедр были полными)
        for i in range(4):
            t_title, t_desc = task_templates[i % len(task_templates)]
            st = ["completed", "completed", "in_progress", "on_review"][i]
            create_task_with_timeline(
                title=f"{t_title} ({dept.name})",
                description=t_desc,
                creator=random.choice([rector, prorector, dean]),
                assignees=[head, staff[i % len(staff)]],
                target_depts=[dept],
                status_val=st,
                days_offset=random.randint(2, 9),
                quality=random.choice([4, 5, 5]) if st == "completed" else None,
                revisions=random.choice([0, 0, 1]) if st == "completed" else 0,
                report_text="Tabşyryk boýunça ähli resminamalar taýýarlandy." if st in ["on_review", "completed"] else None,
            )

        # Индивидуальные задачи каждому преподавателю кафедры от Зав. кафедрой и Деканата
        for emp_idx, emp in enumerate(staff):
            # 1. Завершенные задачи с высокими оценками (2-4 штуки каждому)
            for c_i in range(random.randint(2, 4)):
                t_title, t_desc = random.choice(task_templates)
                rev_cnt = 0 if emp_idx % 2 == 0 else random.choice([0, 1, 2])
                create_task_with_timeline(
                    title=t_title,
                    description=t_desc,
                    creator=head if c_i % 2 == 0 else deputy_dean,
                    assignees=[emp],
                    status_val="completed",
                    days_offset=random.randint(1, 10),
                    quality=random.choice([4, 5, 5]),
                    revisions=rev_cnt,
                    report_text="Ýumuş doly ýerine ýetirildi, hasabat faýly goşuldy.",
                )

            # 2. Активная задача в работе или только созданная
            t_title, t_desc = random.choice(task_templates)
            active_status = random.choice(["created", "in_progress", "on_review"])
            # Сделаем пару задач просроченными для демонстрации фильтра "Просрочено"
            offset_val = -2 if (emp_idx == 2 and active_status == "in_progress") else random.randint(2, 8)
            create_task_with_timeline(
                title=t_title,
                description=t_desc,
                creator=head,
                assignees=[emp],
                status_val=active_status,
                days_offset=offset_val,
                report_text="Iş tamamlanyp barýar, barlaga iberildi." if active_status == "on_review" else None,
            )

            # 3. Задача со статусом "На доработке" и красным замечанием [REVISION]
            if emp_idx % 2 == 1:
                create_task_with_timeline(
                    title="Okuw gollanmasynyň golýazmasyny taýýarlamak",
                    description="Kafedranyň mejlisinde ara alyp maslahatlaşmak üçin gollanmanyň 1-nji bölümini tabşyrmaly.",
                    creator=head,
                    assignees=[emp],
                    status_val="revision",
                    days_offset=3,
                    revisions=1,
                    report_text="Gollanmanyň deslapky nusgasyny iberýärin.",
                    revision_remark="Edebiýatlar sanawyna soňky 3 ýylyň çeşmelerini goşmaly we 2-nji bapdaky таблиsalary düzetmeli.",
                )

    print("5/6 Заполнение календаря посещаемости (включая рабочие субботы)...")

    for u in all_users:
        # У каждого сотрудника свой уровень пунктуальности для красивого разброса на графиках
        late_probability = 0.05 if u.is_rectorate or u.is_manager else random.uniform(0.05, 0.28)

        for day_back in range(24):
            d_date = today - timedelta(days=day_back)
            # В вузе шестидневка: пропускаем только воскресенье (weekday == 6)
            if d_date.weekday() == 6:
                continue

            # Если сегодня и сотрудник в отпуске/больничном — не ставим явку за сегодня
            if day_back == 0 and u.work_status != "working":
                continue

            is_late = random.random() < late_probability
            arr_time = (
                dt_time(8, random.randint(32, 55))
                if is_late
                else dt_time(7, random.randint(45, 59))
            )
            st_val = "late" if is_late else "on_time"

            try:
                att = DailyAttendance.objects.create(
                    user=u,
                    date=d_date,
                    arrival_time=arr_time,
                    status=st_val,
                )
                # Принудительный update на случай auto_now_add в модели
                DailyAttendance.objects.filter(id=att.id).update(date=d_date, arrival_time=arr_time)
            except IntegrityError:
                pass

    print("6/6 Выдача достижений и выговоров в личные дела по субординации...")

    reward_texts = [
        "Halkara olimpiadasyna talyplary üstünlikli taýýarlandygy üçin minnetdarlyk.",
        "Ylmy-amaly maslahatda iň gowy çykyş edendigi we işjeňligi üçin sylag.",
        "Täze elektron okuw-usulyýet toplumyny işläp düzendigi üçin hormat haty.",
    ]
    reprimand_texts = [
        "Kafedranyň mejlisine wagtynda gelmändigi üçin duýduryş.",
        "Aralyk synag hasabatlaryny gijikdirip tabşyrandygy üçin bellik.",
    ]

    for dept in all_depts:
        head = heads_by_dept[dept]
        # Декан выдает награду заведующему кафедрой
        EmployeeRecord.objects.create(
            user=head,
            record_type="reward",
            description="Kafedranyň okuw we ylmy işlerini ýokary derejede gurandygy üçin minnetdarlyk.",
            author=dean,
        )

        for idx, emp in enumerate(teachers_by_dept[dept]):
            # Каждому сотруднику 1-2 награды от заведующего или декана
            EmployeeRecord.objects.create(
                user=emp,
                record_type="reward",
                description=reward_texts[idx % len(reward_texts)],
                author=head if idx % 2 == 0 else dean,
            )
            # Некоторым сотрудникам по 1 замечанию для демонстрации вкладки "Выговоры"
            if idx == 2:
                EmployeeRecord.objects.create(
                    user=emp,
                    record_type="reprimand",
                    description=reprimand_texts[idx % len(reprimand_texts)],
                    author=head,
                )

    print("\n========================================================")
    print("БАЗА ДАННЫХ УСПЕШНО ЗАПОЛНЕНА ДЛЯ ДЕМОНСТРАЦИИ ПРОЕКТА!")
    print("Единый пароль для всех аккаунтов: 12345")
    print("--------------------------------------------------------")
    print("Руководство:")
    print("  • Ректор:            rector_demo")
    print("  • Проректор:         prorector_demo")
    print("  • Декан:             dean_demo")
    print("  • Зам. декана:       deputy_dean_demo")
    print("Заведующие кафедрами:")
    print("  • Комп. науки:       mergen_gurbanow_demo")
    print("  • Инф. системы:      basim_nyyazow_demo")
    print("  • Кибербезопасность: gurbanguly_durdyyew_demo")
    print("  • Прикл. мат. и ИИ:  begenc_soltanow_demo")
    print("Примеры преподавателей:")
    print("  • Профессор:         aygul_mammedowa_demo")
    print("  • Ст. преподаватель: serdar_orazow_demo")
    print("  • Доцент:            jemal_atayewa_demo")
    print("========================================================\n")


if __name__ == "__main__":
    run_seed()