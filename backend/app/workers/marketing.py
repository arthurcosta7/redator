"""Agendamento isolado dos relatórios; não bloqueia correções de redação."""
from typing import Any, ClassVar

from arq import cron

from app.core.job_queue import get_arq_redis_settings
from app.jobs.marketing_weekly_report import send_marketing_weekly_report


class WorkerSettings:
    functions: ClassVar[list[Any]] = []
    cron_jobs: ClassVar[list[Any]] = [cron(send_marketing_weekly_report, weekday=0, hour=12, minute=0)]
    redis_settings = get_arq_redis_settings()
    queue_name = "arq:queue:marketing"
    max_jobs = 1
    job_timeout = 120
    health_check_key = "arq:health:marketing"
