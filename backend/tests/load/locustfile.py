"""Cenários de carga HTTP. Escritas ficam desabilitadas por padrão."""
import os

from locust import HttpUser, between, events, task
from locust.exception import StopUser


class PublicTraffic(HttpUser):
    wait_time = between(0.1, 0.8)
    weight = 3

    @task(10)
    def liveness(self):
        self.client.get("/health", name="GET /health")

    @task(1)
    def readiness(self):
        self.client.get("/ready", name="GET /ready")


class AuthenticatedReads(HttpUser):
    # Sem token, o perfil nao participa do sorteio de usuarios. Isso mantem o
    # smoke publico com a concorrencia solicitada e evita StopUser ruidoso.
    abstract = not bool(os.getenv("LOAD_TEST_ACCESS_TOKEN"))
    wait_time = between(0.5, 2.0)
    weight = 7

    def on_start(self):
        token = os.getenv("LOAD_TEST_ACCESS_TOKEN")
        if not token:
            raise StopUser()
        self.client.headers.update({"Authorization": f"Bearer {token}"})

    @task(5)
    def essays(self):
        self.client.get("/api/v1/essays?per_page=10", name="GET /essays")

    @task(2)
    def daily_limit(self):
        self.client.get("/api/v1/essays/daily-limit", name="GET /essays/daily-limit")

    @task(1)
    def profile(self):
        self.client.get("/api/v1/users/me", name="GET /users/me")


class ExplicitWriteTest(HttpUser):
    abstract = (
        os.getenv("LOAD_TEST_ALLOW_WRITES") != "1"
        or not bool(os.getenv("LOAD_TEST_ACCESS_TOKEN"))
    )
    wait_time = between(10, 20)
    weight = 1

    def on_start(self):
        token = os.getenv("LOAD_TEST_ACCESS_TOKEN")
        if not token:
            raise StopUser()
        self.client.headers.update({"Authorization": f"Bearer {token}"})

    @task
    def submit_essay(self):
        content = " ".join(["argumentação"] * 150)
        self.client.post(
            "/api/v1/essays",
            name="POST /essays (CUSTO REAL)",
            json={
                "title": "Carga autorizada",
                "content": content,
                "theme": "Educação e cidadania no Brasil contemporâneo",
                "essay_type": "enem",
            },
        )


@events.quitting.add_listener
def enforce_slo(environment, **kwargs):
    stats = environment.runner.stats.total
    if stats.num_requests and (stats.fail_ratio > 0.01 or stats.get_response_time_percentile(0.95) > 1000):
        environment.process_exit_code = 1
