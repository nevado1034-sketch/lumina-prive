-- =========================================================
-- Lúmina Privé · Esquema de base de datos (PostgreSQL 15+)
-- Prototipo demo · forme69.com · Solo adultos (+18)
--
-- Cumplimiento:
--   · Ley N.º 29733 de Protección de Datos Personales (Perú)
--     y D.S. N.º 016-2024-JUS
--   · Verificación de edad obligatoria (KYC vía proveedor externo;
--     los documentos NUNCA se guardan en esta base)
--   · Registros de consentimiento por publicación
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;        -- emails insensibles a mayúsculas

-- ---------------------------------------------------------
-- 1) USERS — cuentas (clientes y creadoras y staff)
-- ---------------------------------------------------------
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role                TEXT NOT NULL CHECK (role IN ('cliente','creadora','admin','soporte')),
    email               CITEXT UNIQUE,
    phone               TEXT,
    password_hash       TEXT NOT NULL,            -- Argon2id / bcrypt (nunca texto plano)
    status              TEXT NOT NULL DEFAULT 'activo'
                        CHECK (status IN ('activo','suspendido','baneado','borrado')),
    two_factor_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
    age_verified_at     TIMESTAMPTZ,              -- declaración/KYC superado
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_contact_chk CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

-- ---------------------------------------------------------
-- 2) CREATOR_PROFILES — perfil público de la creadora
-- ---------------------------------------------------------
CREATE TABLE creator_profiles (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stage_name           TEXT NOT NULL,
    slug                 CITEXT UNIQUE NOT NULL,   -- /perfil/{slug}
    bio                  TEXT,
    languages            TEXT[] NOT NULL DEFAULT '{}',
    category             TEXT,
    response_time        TEXT,
    monthly_price_cents  INTEGER CHECK (monthly_price_cents >= 0),
    yearly_price_cents   INTEGER CHECK (yearly_price_cents >= 0),
    kyc_provider         TEXT,                     -- ej. 'sumsub'
    kyc_reference        TEXT,                     -- ID del proveedor (sin documentos)
    verification_status  TEXT NOT NULL DEFAULT 'pendiente'
                         CHECK (verification_status IN ('pendiente','en_revision','verificada','rechazada')),
    verified_at          TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_creator_profiles_status ON creator_profiles(verification_status);

-- ---------------------------------------------------------
-- 3) SUBSCRIPTIONS — membresías con renovación visible
-- ---------------------------------------------------------
CREATE TABLE subscriptions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    creator_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id       TEXT NOT NULL CHECK (plan_id IN ('mensual','anual')),
    price_cents   INTEGER NOT NULL CHECK (price_cents >= 0),
    status        TEXT NOT NULL DEFAULT 'activa'
                  CHECK (status IN ('activa','cancelada','vencida')),
    started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    renews_at     TIMESTAMPTZ,                    -- próxima renovación (visible al cliente)
    cancelled_at  TIMESTAMPTZ,
    CONSTRAINT subscriptions_distinct_chk CHECK (customer_id <> creator_id),
    CONSTRAINT subscriptions_unique_active UNIQUE (customer_id, creator_id, plan_id, status)
);
CREATE INDEX idx_subs_customer ON subscriptions(customer_id, status);

-- ---------------------------------------------------------
-- 4) POSTS — publicaciones (gratis / miembros / premium)
-- ---------------------------------------------------------
CREATE TABLE posts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title             TEXT NOT NULL,
    storage_key       TEXT NOT NULL,               -- clave S3 privado (URL firmada temporal al servir)
    visibility        TEXT NOT NULL
                      CHECK (visibility IN ('gratis','miembros','premium')),
    price_cents       INTEGER CHECK (price_cents >= 0),
    moderation_status TEXT NOT NULL DEFAULT 'en_revision'
                      CHECK (moderation_status IN ('en_revision','aprobado','retirado')),
    hash_sha256       TEXT,                        -- anti-repost / CSAM matching
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_posts_creator ON posts(creator_id, moderation_status);

-- Compra individual de contenido premium (PPV)
CREATE TABLE post_unlocks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id      UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    customer_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    price_paid_cents INTEGER NOT NULL,
    watermark_user_ref TEXT NOT NULL,              -- marca de agua dinámica por comprador
    unlocked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (post_id, customer_id)
);

-- ---------------------------------------------------------
-- 5) CONVERSATIONS — mensajería privada
-- ---------------------------------------------------------
CREATE TABLE conversations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status       TEXT NOT NULL DEFAULT 'abierta'
                 CHECK (status IN ('abierta','bloqueada','cerrada')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT conversations_distinct_chk CHECK (creator_id <> customer_id),
    UNIQUE (creator_id, customer_id)
);

-- ---------------------------------------------------------
-- 6) MESSAGES — mensajes (con soporte de mensaje pagado)
-- ---------------------------------------------------------
CREATE TABLE messages (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id   UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body              TEXT,
    media_key         TEXT,                        -- adjunto opcional (S3 privado)
    price_cents       INTEGER DEFAULT 0,           -- > 0 ⇒ requiere pago para ver adjunto
    paid_at           TIMESTAMPTZ,                 -- momento del desbloqueo
    moderation_status TEXT NOT NULL DEFAULT 'aprobado'
                      CHECK (moderation_status IN ('en_revision','aprobado','retirado')),
    sent_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conv ON messages(conversation_id, sent_at DESC);

-- ---------------------------------------------------------
-- 7) REPORTS — denuncias (prioridad: menores/deepfakes/no consentimiento)
-- ---------------------------------------------------------
CREATE TABLE reports (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    reason      TEXT NOT NULL CHECK (reason IN (
                  'suplantacion','contenido_robado','posible_menor',
                  'acoso_chantaje','deepfake_no_consentido','material_no_consentido','otro')),
    detail      TEXT,
    status      TEXT NOT NULL DEFAULT 'recibida'
                CHECK (status IN ('recibida','en_revision','resuelta','descartada')),
    is_priority BOOLEAN GENERATED ALWAYS AS (
                  reason IN ('posible_menor','deepfake_no_consentido','material_no_consentido')
                ) STORED,                          -- suspende preventivamente
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

-- ---------------------------------------------------------
-- 8) PAYOUTS — retiros de las creadoras
-- ---------------------------------------------------------
CREATE TABLE payouts (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_cents       INTEGER NOT NULL CHECK (amount_cents > 0),
    status             TEXT NOT NULL DEFAULT 'solicitado'
                       CHECK (status IN ('solicitado','en_proceso','pagado','fallido')),
    provider_reference TEXT,
    requested_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at            TIMESTAMPTZ
);

-- =========================================================
-- TABLAS COMPLEMENTARIAS (transparencia y cumplimiento)
-- =========================================================

-- Cupones oficiales (se aplican antes del cobro)
CREATE TABLE coupons (
    code        CITEXT PRIMARY KEY,
    pct_off     SMALLINT NOT NULL CHECK (pct_off BETWEEN 1 AND 90),
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at  TIMESTAMPTZ
);

-- Transacciones / recibos (historial visible al cliente)
CREATE TABLE transactions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind          TEXT NOT NULL CHECK (kind IN (
                    'recarga','suscripcion','ppv','propina','videollamada','reembolso','retiro')),
    amount_cents  INTEGER NOT NULL,                -- negativo = cargo, positivo = abono
    ref_type      TEXT,
    ref_id        UUID,
    provider_ref  TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tx_user ON transactions(user_id, created_at DESC);

-- Videollamadas con pago anticipado
CREATE TABLE vcall_requests (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    minutes      SMALLINT NOT NULL CHECK (minutes IN (15,30)),
    price_cents  INTEGER NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pendiente'
                 CHECK (status IN ('pendiente','pagada','aceptada','completada','rechazada','reembolsada')),
    room_ref     TEXT,                             -- sala WebRTC efímera
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Registro de consentimiento por material (retirable)
CREATE TABLE consent_records (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id     UUID REFERENCES posts(id) ON DELETE SET NULL,
    declaration TEXT NOT NULL,                     -- "material propio, todos +18, autorización escrita"
    withdrawn_at TIMESTAMPTZ,                      -- retiro del consentimiento
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auditoría inmutable de acciones sensibles
CREATE TABLE audit_log (
    id         BIGSERIAL PRIMARY KEY,
    actor_role TEXT NOT NULL,
    action     TEXT NOT NULL,
    meta       JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bloqueos entre cuentas
CREATE TABLE blocks (
    blocker_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id)
);

-- =========================================================
-- Notas de seguridad operativa
--   · Multimedia en bucket S3 privado; acceso SOLO vía URLs firmadas temporales
--   · Marca de agua dinámica con referencia del comprador (post_unlocks)
--   · Documentos KYC residen cifrados en el proveedor externo, no aquí
--   · Denuncias prioritarias (is_priority = true) suspenden la cuenta objetivo
--     de forma preventiva hasta resolución humana < 1 hora
-- =========================================================
