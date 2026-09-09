"""
auth.py — Endpoints de autenticação

Rotas:
- POST /auth/register/student   — Cria conta de aluno
- POST /auth/register/teacher   — Cria conta de professor
- POST /auth/login               — Login
- POST /auth/logout              — Logout (revoga tokens)
- POST /auth/refresh             — Renova access token
- POST /auth/forgot-password     — Solicita reset de senha
- POST /auth/reset-password      — Define nova senha
- POST /auth/verify-email/{token} — Verifica email
"""
from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, HTTPException, Path, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_db, get_redis
from app.core.logging import get_logger, mask_email
from app.core.rate_limiter import RateLimiter, check_login_attempts
from app.core.security import (
    DUMMY_HASH,
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_secure_token,
    generate_token_hash,
    hash_password,
    verify_password,
)
from app.db.models.refresh_token import RefreshToken
from app.db.models.user import User, UserPlan, UserType
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RegisterStudentRequest,
    RegisterTeacherRequest,
    ResetPasswordRequest,
)

router = APIRouter(prefix="/auth", tags=["Autenticação"])
logger = get_logger(__name__)


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """
    Define os cookies de autenticação na resposta.

    httpOnly=True: JavaScript NÃO consegue ler — protege contra XSS
    secure=True: Apenas em HTTPS — protege contra interceptação
    samesite="strict": Não enviado em requisições cross-origin — protege contra CSRF
    """
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.is_production,  # Apenas HTTPS em produção
        samesite="strict",
        max_age=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.is_production,
        samesite="strict",
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/api/v1/auth/refresh",   # Só enviado para o endpoint de refresh
    )


def clear_auth_cookies(response: Response) -> None:
    """Remove os cookies de autenticação (logout)."""
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/v1/auth/refresh")


# ─────────────────────────────────────────────────────────────────────────────
# Registro
# ─────────────────────────────────────────────────────────────────────────────

async def create_user(
    db: AsyncSession,
    full_name: str,
    email: str,
    password: str,
    user_type: UserType,
    **extra_fields,
) -> User | None:
    """
    Cria um novo usuário no banco.

    Verifica duplicidade de email antes de criar.
    Envia email de verificação após criar.
    """
    # O hash é calculado mesmo para email duplicado para reduzir diferenças de
    # tempo que poderiam ser usadas para enumerar contas existentes.
    hashed_password = hash_password(password)

    # Verifica se email já existe
    existing = await db.execute(select(User).where(User.email == email.lower()))
    if existing.scalar_one_or_none():
        # O endpoint continua retornando a mesma resposta 201 usada para um novo
        # cadastro, sem confirmar se o endereço já existe.
        return None

    # Gera token de verificação de email
    verification_token = generate_secure_token(32)
    token_hash = generate_token_hash(verification_token)
    token_expires = datetime.now(timezone.utc) + timedelta(hours=24)

    user = User(
        full_name=full_name,
        email=email.lower(),                    # Sempre lowercase para consistência
        hashed_password=hashed_password,
        user_type=user_type,
        plan=UserPlan.FREE,
        email_verification_token_hash=token_hash,
        email_verification_expires_at=token_expires,
        **extra_fields,
    )

    db.add(user)
    await db.flush()  # Gera o ID sem commit ainda

    logger.info(
        "usuario_criado",
        user_id=str(user.id),
        user_type=user_type,
        email=mask_email(email),    # Mascara no log
    )

    # Envia email de verificação (assíncrono, não bloqueia o registro)
    try:
        from app.services.email.email_service import EmailService
        await EmailService().send_verification_email(
            to_email=email,
            to_name=full_name,
            verification_token=verification_token,
        )
    except Exception as e:
        # Log do erro mas não falha o registro
        logger.error("erro_envio_email_verificacao", error=str(e))

    return user


@router.post("/register/student", response_model=MessageResponse, status_code=201)
async def register_student(
    data: RegisterStudentRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis_client=Depends(get_redis),
) -> MessageResponse:
    """Cria uma conta de aluno."""
    ip = request.client.host if request.client else "unknown"
    limiter = RateLimiter(redis_client)
    if not await limiter.check("registration", ip, max_requests=5, window_seconds=3600):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas de cadastro. Aguarde 1 hora.",
            headers={"Retry-After": "3600"},
        )
    await create_user(
        db=db,
        full_name=data.full_name,
        email=data.email,
        password=data.password,
        user_type=UserType.STUDENT,
        grade=data.grade,
    )
    return MessageResponse(
        message="Conta criada! Verifique seu email para ativar a conta."
    )


@router.post("/register/teacher", response_model=MessageResponse, status_code=201)
async def register_teacher(
    data: RegisterTeacherRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis_client=Depends(get_redis),
) -> MessageResponse:
    """Cria uma conta de professor."""
    ip = request.client.host if request.client else "unknown"
    limiter = RateLimiter(redis_client)
    if not await limiter.check("registration", ip, max_requests=5, window_seconds=3600):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas de cadastro. Aguarde 1 hora.",
            headers={"Retry-After": "3600"},
        )
    await create_user(
        db=db,
        full_name=data.full_name,
        email=data.email,
        password=data.password,
        user_type=UserType.TEACHER,
        school_name=data.school_name,
        discipline=data.discipline,
    )
    return MessageResponse(
        message="Conta criada! Verifique seu email para ativar a conta."
    )


# ─────────────────────────────────────────────────────────────────────────────
# Login
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=AuthResponse)
async def login(
    data: LoginRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis_client=Depends(get_redis),
) -> AuthResponse:
    """
    Autentica o usuário e retorna tokens via cookies httpOnly.

    Proteção contra brute force:
    - 5 tentativas por IP a cada 15 minutos
    - 20 tentativas por IP a cada hora
    - Bloqueio progressivo da conta por tentativas na mesma conta
    """
    ip = request.client.host if request.client else "unknown"

    # Verifica rate limit por IP
    if not await check_login_attempts(ip, redis_client):
        logger.warning("login_bloqueado_rate_limit", ip=ip[:15])
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas de login. Aguarde 15 minutos.",
            headers={"Retry-After": "900"},
        )

    # Busca usuário pelo email
    result = await db.execute(
        select(User).where(User.email == data.email.lower())
    )
    user = result.scalar_one_or_none()

    # SEGURANÇA: Mesmo que o usuário não exista, verificamos a senha de qualquer forma
    # (constant-time operation para prevenir timing attacks)
    password_hash = user.hashed_password if user else DUMMY_HASH

    password_correct = verify_password(data.password, password_hash)

    # Todas as verificações de falha DEPOIS da verificação de senha
    if not user or not password_correct:
        if user:
            # Incrementa contador de tentativas falhas
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            # Bloqueia a conta após 10 tentativas consecutivas
            if user.failed_login_attempts >= 10:
                user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=30)
                logger.warning("conta_bloqueada", user_id=str(user.id))
            await db.flush()

        logger.warning("falha_login", ip=ip[:15])
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            # SEGURANÇA: Mensagem genérica — não diz se email ou senha está errado
            detail="Email ou senha incorretos",
        )

    # Verificações adicionais após senha correta
    if user.is_locked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conta temporariamente bloqueada. Tente novamente em 30 minutos.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conta desativada. Entre em contato com o suporte.",
        )

    if not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verifique seu email antes de fazer login.",
        )

    # Login bem-sucedido — reseta contador de tentativas
    user.failed_login_attempts = 0
    user.locked_until = None

    # Cria tokens
    access_token = create_access_token(
        user_id=str(user.id),
        user_type=user.user_type.value,
        plan=user.plan.value,
    )
    refresh_token = create_refresh_token(user_id=str(user.id))

    # Salva hash do refresh token no banco
    refresh_token_record = RefreshToken(
        user_id=user.id,
        token_hash=generate_token_hash(refresh_token),
        expires_at=datetime.now(timezone.utc) + timedelta(
            days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS
        ),
        created_from_ip=ip,
        user_agent=request.headers.get("user-agent", "")[:200],
    )
    db.add(refresh_token_record)

    # Define cookies seguros
    set_auth_cookies(response, access_token, refresh_token)

    logger.info("login_bem_sucedido", user_id=str(user.id), ip=ip[:15])

    return AuthResponse(
        message="Login realizado com sucesso",
        user_type=user.user_type.value,
        plan=user.plan.value,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Refresh Token
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/refresh", response_model=AuthResponse)
async def refresh_token(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AuthResponse:
    """
    Renova o access token usando o refresh token do cookie.

    Implementa rotação de refresh tokens:
    - O refresh token antigo é revogado
    - Um NOVO refresh token é emitido
    - Se o token antigo já estava revogado = ALERTA de comprometimento!
    """
    refresh_token_value = request.cookies.get("refresh_token")

    if not refresh_token_value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão expirada. Faça login novamente.",
        )

    try:
        payload = decode_token(refresh_token_value)
        if payload.get("type") != "refresh":
            raise jwt.InvalidTokenError()
        user_id = UUID(payload["sub"])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, TypeError, ValueError):
        clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão expirada. Faça login novamente.",
        )

    # Busca o token no banco pelo hash
    token_hash = generate_token_hash(refresh_token_value)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.user_id == user_id,
        )
    )
    token_record = result.scalar_one_or_none()

    if not token_record:
        # Token não encontrado — possível ataque de replay
        logger.warning("refresh_token_nao_encontrado", user_id=user_id)
        clear_auth_cookies(response)
        raise HTTPException(status_code=401, detail="Sessão inválida.")

    if not token_record.is_valid:
        # ALERTA: Token já revogado foi usado — possível comprometimento!
        logger.error(
            "refresh_token_ja_revogado_usado",
            user_id=user_id,
            token_id=str(token_record.id),
        )
        # Revoga TODOS os tokens do usuário como medida de segurança
        all_tokens = await db.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
            )
        )
        now = datetime.now(timezone.utc)
        for t in all_tokens.scalars():
            t.revoked_at = now

        clear_auth_cookies(response)
        raise HTTPException(
            status_code=401,
            detail="Sessão inválida. Por segurança, faça login novamente.",
        )

    # Busca o usuário
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()

    if not user or not user.is_active:
        clear_auth_cookies(response)
        raise HTTPException(status_code=401, detail="Sessão inválida.")

    # Revoga o token antigo
    token_record.revoked_at = datetime.now(timezone.utc)

    # Cria novos tokens
    new_access_token = create_access_token(
        user_id=str(user.id),
        user_type=user.user_type.value,
        plan=user.plan.value,
    )
    new_refresh_token = create_refresh_token(user_id=str(user.id))

    # Salva o novo refresh token
    new_token_record = RefreshToken(
        user_id=user.id,
        token_hash=generate_token_hash(new_refresh_token),
        expires_at=datetime.now(timezone.utc) + timedelta(
            days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS
        ),
        created_from_ip=request.client.host if request.client else None,
    )
    db.add(new_token_record)

    set_auth_cookies(response, new_access_token, new_refresh_token)

    return AuthResponse(
        message="Sessão renovada",
        user_type=user.user_type.value,
        plan=user.plan.value,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Logout
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    """
    Encerra a sessão do usuário.

    Revoga o refresh token no banco e limpa os cookies.
    """
    refresh_token_value = request.cookies.get("refresh_token")

    if refresh_token_value:
        try:
            payload = decode_token(refresh_token_value)
            user_id = payload.get("sub")
            if user_id:
                token_hash = generate_token_hash(refresh_token_value)
                result = await db.execute(
                    select(RefreshToken).where(RefreshToken.token_hash == token_hash)
                )
                token_record = result.scalar_one_or_none()
                if token_record:
                    token_record.revoked_at = datetime.now(timezone.utc)
        except jwt.InvalidTokenError:
            pass  # Token inválido mas ainda limpamos os cookies

    clear_auth_cookies(response)
    return MessageResponse(message="Logout realizado com sucesso")


# ─────────────────────────────────────────────────────────────────────────────
# Verificação de Email
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/verify-email/{token}", response_model=MessageResponse)
async def verify_email(
    token: Annotated[str, Path(min_length=32, max_length=256)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MessageResponse:
    """Verifica o email do usuário usando o token do link enviado."""
    token_hash = generate_token_hash(token)

    result = await db.execute(
        select(User).where(User.email_verification_token_hash == token_hash)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=400, detail="Link inválido ou expirado.")

    if user.email_verification_expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Link expirado. Solicite um novo.")

    user.is_email_verified = True
    user.email_verification_token_hash = None
    user.email_verification_expires_at = None

    logger.info("email_verificado", user_id=str(user.id))
    return MessageResponse(message="Email verificado com sucesso! Você pode fazer login.")


# ─────────────────────────────────────────────────────────────────────────────
# Reset de Senha
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification_email(
    data: ForgotPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis_client=Depends(get_redis),
    request: Request = None,
) -> MessageResponse:
    """
    Reenvia o email de verificação para o endereço informado.

    SEGURANÇA:
    - Rate limit: 3 tentativas por IP por hora
    - Sempre retorna a mesma mensagem (anti-enumeration)
    - Gera novo token mesmo que o anterior não tenha expirado
    """
    ip = request.client.host if request and request.client else "unknown"

    limiter = RateLimiter(redis_client)
    allowed = await limiter.check("resend_verification", ip, max_requests=3, window_seconds=3600)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas. Aguarde 1 hora.",
        )

    result = await db.execute(
        select(User).where(User.email == data.email.lower())
    )
    user = result.scalar_one_or_none()

    if user and not user.is_email_verified:
        verification_token = generate_secure_token(32)
        token_hash = generate_token_hash(verification_token)
        token_expires = datetime.now(timezone.utc) + timedelta(hours=24)

        user.email_verification_token_hash = token_hash
        user.email_verification_expires_at = token_expires

        try:
            from app.services.email.email_service import EmailService
            await EmailService().send_verification_email(
                to_email=user.email,
                to_name=user.full_name,
                verification_token=verification_token,
            )
            logger.info("verificacao_reenviada", user_id=str(user.id))
        except Exception as e:
            logger.error("erro_reenvio_verificacao", error=str(e))

    return MessageResponse(
        message="Se este email estiver cadastrado e não verificado, você receberá um novo link em breve."
    )


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    data: ForgotPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis_client=Depends(get_redis),
    request: Request = None,
) -> MessageResponse:
    """
    Envia email de reset de senha.

    SEGURANÇA: Sempre retorna sucesso, mesmo se o email não existir.
    Isso previne enumeration attack (descobrir emails cadastrados).
    """
    ip = request.client.host if request and request.client else "unknown"

    # Rate limit no reset de senha também
    limiter = RateLimiter(redis_client)
    allowed = await limiter.check("password_reset", ip, max_requests=3, window_seconds=3600)
    if not allowed:
        raise HTTPException(status_code=429, detail="Muitas tentativas. Aguarde 1 hora.")

    # Busca o usuário
    result = await db.execute(
        select(User).where(User.email == data.email.lower())
    )
    user = result.scalar_one_or_none()

    # Mesmo se usuário não existir, faz tudo igual (timing attack prevention)
    reset_token = generate_secure_token(32)
    token_hash = generate_token_hash(reset_token)
    token_expires = datetime.now(timezone.utc) + timedelta(hours=1)

    if user:
        user.password_reset_token_hash = token_hash
        user.password_reset_expires_at = token_expires

        try:
            from app.services.email.email_service import EmailService
            await EmailService().send_password_reset_email(
                to_email=user.email,
                to_name=user.full_name,
                reset_token=reset_token,
            )
        except Exception as e:
            logger.error("erro_envio_email_reset", error=str(e))

    # Sempre retorna a mesma mensagem
    return MessageResponse(
        message="Se este email estiver cadastrado, você receberá as instruções em breve."
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    data: ResetPasswordRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis_client=Depends(get_redis),
) -> MessageResponse:
    """Define uma nova senha usando o token de reset."""
    ip = request.client.host if request.client else "unknown"
    limiter = RateLimiter(redis_client)
    if not await limiter.check(
        "password_reset_confirmation", ip, max_requests=10, window_seconds=3600
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas. Aguarde 1 hora.",
            headers={"Retry-After": "3600"},
        )

    token_hash = generate_token_hash(data.token)

    result = await db.execute(
        select(User).where(User.password_reset_token_hash == token_hash)
    )
    user = result.scalar_one_or_none()

    if not user or user.password_reset_expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Link inválido ou expirado.")

    # Atualiza senha
    user.hashed_password = hash_password(data.new_password)
    user.password_reset_token_hash = None
    user.password_reset_expires_at = None
    user.failed_login_attempts = 0
    user.locked_until = None

    # Revoga todos os refresh tokens (segurança após troca de senha)
    all_tokens = await db.execute(
        select(RefreshToken).where(
            RefreshToken.user_id == user.id,
            RefreshToken.revoked_at.is_(None),
        )
    )
    now = datetime.now(timezone.utc)
    for t in all_tokens.scalars():
        t.revoked_at = now

    logger.info("senha_redefinida", user_id=str(user.id))
    return MessageResponse(message="Senha redefinida com sucesso! Você pode fazer login.")
