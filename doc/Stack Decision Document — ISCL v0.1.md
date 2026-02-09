# Stack Decision Document — ISCL v0.1
Version: 1.0  
Owner: (you)  
Date: 2026-02-07

## 1. Контекст и требования

ISCL v0.1 — независимый secure crypto layer, совместимый с OpenClaw, с ключевыми инвариантами:
ключи не доступны skills, подпись только через policy+preflight+approval, sandbox с ограничениями, детерминированные workflows (transfer/approve/swap), audit trace, минимальная зависимость от внутренностей OpenClaw (интеграция по API).

Нефункциональные требования:
высокая надёжность и наблюдаемость
строгая валидация входов (JSON schemas)
быстрое прототипирование, но без “скриптовщины” в критических местах
простая сборка и дистрибуция (локальный daemon)
возможность добавлять новые chains/DEX позже
безопасность важнее скорости разработки

## 2. Архитектура и границы

Domain A: OpenClaw + skills (недоверенный)
Domain B: ISCL Core (доверенный)
Domain C: Secure Executor (ограниченно доверенный)

Технологически это означает:
ISCL Core = один локальный daemon (HTTP/gRPC API), который держит keystore, policy, tx engine, preflight и audit
Sandbox Executor = отдельный runner (контейнер/изоляция), запускаемый Core или рядом с ним
OpenClaw Adapter = тонкие skills-клиенты + инсталлер

Ключевой принцип выбора стека:
наиболее критичный код (подпись, политика, build tx) должен быть на стеке, который легко тестировать, типизировать и поддерживать.

## 3. Выбор языка для ISCL Core

### Кандидаты
A) TypeScript/Node.js
B) Python
C) Go
D) Rust

### Критерии оценки
безопасность и устойчивость (memory safety, predictable runtime)
ecosystem для EVM и симуляций
скорость разработки
операционная простота (один бинарь vs node runtime)
типизация/валидаторы схем
наблюдаемость

### Решение
Рекомендуемый стек для ISCL Core v0.1: **TypeScript (Node 20+)**.

Причины:
высокая скорость разработки и широкая доступность инженеров
очень зрелая EVM экосистема (ethers/viem), удобная работа с calldata/abi
простая интеграция с JSON schema (ajv) и быстрый DX
удобно строить локальный daemon и CLI в одном репозитории
быстро писать интеграционные тесты, мокать RPC, поднимать “devnet” сценарии

Компромиссы:
Node не идеален для “hard security”, но у нас ключи не утекают в skills, а критика в основном в правильной архитектуре + тестах.
Memory safety на уровне языка ниже, чем у Rust, но риск компенсируется:
строгой изоляцией доменов
минимизацией поверхностей API
обязательными security tests
проработанными политиками

Когда стоит перейти на Rust/Go:
если появится необходимость в очень строгом sandbox или high-performance tracing и мы захотим перевести WalletService/Policy в отдельный hardened компонент.
Но для v0.1 TS — оптимальный выбор по time-to-market.

## 4. Framework для API

### Кандидаты
Fastify, Express, NestJS

### Решение
**Fastify** (TS) + OpenAPI/JSON schema.

Причины:
высокая производительность и стабильность
хорошая интеграция со схемами и валидацией
простая структура без тяжёлого фреймворка

## 5. JSON Canonicalization и Hashing

Решение: использовать стандарт **JCS (JSON Canonicalization Scheme)** как единственный метод канонизации.

Реализация:
Node библиотека JCS (или внутренняя реализация, если качество библиотек не устраивает)
keccak256 (ethers/viem)

Почему:
минимизация несовместимостей между языками
возможность “compatibility fixtures” для сторонних агентов

## 6. Crypto/EVM SDK

Решение: **viem** (или ethers v6 как альтернатива).
Предпочтение viem за более строгий интерфейс и удобство.

Для ABI/call decoding: встроенные функции + локальные ABI для allowlisted контрактов.

## 7. Preflight simulation

v0.1:
eth_call + estimateGas + (опционально) trace_call / debug_traceCall, если RPC поддерживает
баланс-диффы считаем через:
pre/post balance reads (ETH + ERC20 balanceOf)
allowance reads (ERC20 allowance)
ожидаемые out/minOut — из параметров swap builder

Примечание:
реальный “state diff” зависит от RPC, поэтому делаем layered approach:
минимум обязателен (balance reads + allowance + gas estimate)
trace — улучшение, где доступно

## 8. Policy Engine

Решение: Policy engine как чистая функция:
PolicyDecision = evaluate(intent, buildPlan, preflight, config)

Хранение политик:
YAML/JSON конфиг локально + возможный UI позже
версионирование policyVersion в audit trace

Почему:
легко тестировать property-based тестами
легко объяснять решения пользователю (“deny because spender not allowlisted”)

## 9. Wallet/Keystore

v0.1 решение:
локальный encrypted keystore файл (например, scrypt/argon2 + AES-GCM)
ключи грузятся в память только после unlock
подпись только внутри WalletService
никаких “raw sign” наружу

Опционально:
интеграция с OS keychain позже
remote signer / hardware wallet как v0.2

## 10. Sandbox Executor

Решение v0.1: **container-based runner**.

Варианты реализации:
A) Docker (простота DX)
B) Podman (ближе к rootless)
C) Firecracker (слишком тяжело для v0.1)

Выбор:
**Docker** для dev и раннего beta, с планом перехода на rootless/Podman при необходимости.

Ограничения:
network allowlist реализуем через:
запуск без сети по умолчанию
или через отдельный user-defined network + прокси
или через eBPF/iptables (сложнее)

FS isolation:
read-only rootfs
ephemeral volume для /tmp
явно разрешённые пути

Process:
no_spawn по умолчанию (на уровне контейнера и runtime policy)

Trace logging:
встроенный “syscall-level” tracing не обязателен в v0.1
достаточно:
логов сети (через прокси)
логов FS доступов (через wrapper, если применимо)
логов запуска процессов (контейнерный runtime)

План v0.2:
добавить Nanoclaw/wasm executor как hardened path для crypto-операций.

## 11. Skill Packaging / Signing

Решение:
Signed Skill Packages на базе SkillManifest v1:
manifestHash = keccak256(canonical(manifest_without_signature))
publisher signature: ECDSA (secp256k1) или ed25519 (выбрать один)

Выбор подписи:
**secp256k1** (так проще для crypto аудитории и совместимо с EVM ключами издателя).

Scanner:
Node-based static scanning:
поиск подозрительных импортов/вызовов
запрещённые домены
динамические загрузки
опасные системные вызовы

## 12. Storage для audit trace

v0.1:
локальный append-only log в JSONL + ротация
опционально sqlite для удобного поиска и корреляции

Решение:
**SQLite** (лучше для запросов, и всё равно локально), плюс экспорт JSONL.

## 13. Observability

Логи: pino (структурированные)
Метрики: Prometheus endpoint (опционально)
Трейсинг: OpenTelemetry (минимум на API вызовы)

## 14. CI/CD и тестирование

CI: GitHub Actions
Тесты:
unit tests (vitest/jest)
integration tests (запуск локального ISCL, моки RPC)
e2e tests (поднятие тестнета/форка, выполнение swap на testnet)
security tests (evil skills, sandbox enforcement)

Совместимость OpenClaw:
матрица pinned version + latest stable (adapter tests)

## 15. Repo layout

/ core          ISCL core services (API, wallet, policy, tx)
/ sandbox       runner и политики изоляции
/ adapter       OpenClaw thin skills + installer
/ spec          schemas, fixtures, canonicalization rules
/ tests         unit/integration/e2e/security
/ docs          PRD, security blueprint, stack decision

## 16. Риски выбранного стека и митигации

Риск: Node supply chain
Митигация: lockfiles, dependabot, сканирование, ограничение deps, репродьюсибл сборки по мере роста

Риск: Docker sandbox не идеален
Митигация: минимизируем privileges, no-network default, rootless где возможно, trace + policy, v0.2 переход на более строгий executor

Риск: RPC симуляции ненадёжны
Митигация: multi-RPC опционально, conservative risk scoring, mandatory human approval при неопределённости

## 17. Итог

ISCL v0.1:
ISCL Core = TypeScript + Fastify + viem + AJV + SQLite
Sandbox = Docker-based runner
Adapter = thin OpenClaw skills calling localhost ISCL API
Signing = secp256k1, policies обязательны, audit trace всегда

v0.2:
опционально вынести hardened signer/service на Rust/Go
добавить Nanoclaw/wasm executor для более строгого безопасного выполнения
