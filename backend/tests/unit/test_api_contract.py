"""Smoke tests e inventário das rotas públicas do contrato HTTP."""
import pytest

from app.main import app


EXPECTED_ROUTES = {
    ("GET", "/health"),
    ("GET", "/ready"),
    ("POST", "/api/v1/auth/register/student"),
    ("POST", "/api/v1/auth/register/teacher"),
    ("POST", "/api/v1/auth/login"),
    ("POST", "/api/v1/auth/refresh"),
    ("POST", "/api/v1/auth/logout"),
    ("POST", "/api/v1/essays"),
    ("POST", "/api/v1/essays/photo"),
    ("GET", "/api/v1/essays/daily-limit"),
    ("GET", "/api/v1/essays/{essay_id}"),
    ("GET", "/api/v1/users/me"),
    ("POST", "/api/v1/checkout/session"),
    ("POST", "/api/v1/webhooks/stripe"),
    ("POST", "/api/v1/appeals"),
    ("GET", "/api/v1/appeals/review-queue"),
    ("POST", "/api/v1/appeals/{appeal_id}/resolve"),
    ("GET", "/api/v1/professor/turmas"),
    ("POST", "/api/v1/professor/turmas"),
    ("GET", "/api/v1/professor/slots"),
    ("GET", "/api/v1/admin/stats"),
    ("GET", "/api/v1/admin/users"),
}


def test_critical_routes_remain_registered():
    actual = {
        (method.upper(), path)
        for path, operations in app.openapi()["paths"].items()
        for method in operations
    }
    actual |= {("GET", "/health"), ("GET", "/ready")}
    assert EXPECTED_ROUTES <= actual


def test_mutating_routes_do_not_accidentally_accept_get():
    methods_by_path = {
        path: {method.upper() for method in operations}
        for path, operations in app.openapi()["paths"].items()
    }
    for path in (
        "/api/v1/auth/login",
        "/api/v1/auth/reset-password",
        "/api/v1/checkout/session",
        "/api/v1/webhooks/stripe",
        "/api/v1/appeals/{appeal_id}/resolve",
    ):
        assert "GET" not in methods_by_path[path]


@pytest.mark.asyncio
async def test_liveness_response_is_minimal_and_no_store(client):
    response = await client.get("/health", headers={"X-Request-ID": "contract-test"})
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["x-request-id"] == "contract-test"
    assert "server" not in response.headers


@pytest.mark.asyncio
async def test_unknown_api_route_is_not_cached(client):
    response = await client.get("/api/v1/does-not-exist")
    assert response.status_code == 404
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
async def test_validation_error_has_stable_public_shape(client):
    response = await client.post("/api/v1/auth/login", json={})
    assert response.status_code == 422
    body = response.json()
    assert body["detail"] == "Dados inválidos"
    assert {item["field"] for item in body["errors"]} >= {"email", "password"}
