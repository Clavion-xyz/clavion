# ISCL v0.1 — Implementation Roadmap with Man-Week Estimates

## Assumptions

Команда:

- 1 senior backend engineer (crypto / infra)
    
- 1 backend/fullstack engineer
    
- 1 security/infra engineer (part-time ~0.5 FTE)
    
- 1 tech lead (может быть совмещен с senior)
    

Спринты: 1 неделя  
Горизонт: ~8–10 недель до production beta

Оценки включают разработку + тесты + рефакторинг, но не включают внешний аудит.

---

## Phase 0 — Architecture Freeze & Spec Lock (Week 1)

### Scope

- финализация TxIntent / SkillManifest
    
- threat model freeze
    
- API contract freeze
    
- repo scaffolding
    
- CI skeleton
    

### Work Breakdown

Spec finalization — 1 mw  
Repo & CI setup — 0.5 mw  
Architecture doc — 0.5 mw

### Total

**2 man-weeks**

### Parallelization

Полностью параллельно с Phase 1 planning.

---

## Phase 1 — Core API Skeleton (Week 1–2)

### Scope

- HTTP server scaffold
    
- schema validation pipeline
    
- canonical JSON hashing
    
- fixtures + unit tests
    
- health endpoints
    

### Work Breakdown

API framework — 1 mw  
Schema validation — 1 mw  
Canonicalization — 1 mw  
Test harness — 1 mw

### Total

**4 man-weeks**

### Critical Path

Schema + canonicalization must finish first.

---

## Phase 2 — Wallet & Policy Engine (Week 2–3)

### Scope

- encrypted keystore
    
- wallet abstraction
    
- signing pipeline
    
- policy engine
    
- approval CLI
    

### Work Breakdown

Keystore implementation — 2 mw  
Signing pipeline — 1 mw  
Policy engine — 2 mw  
Approval UI — 1 mw

### Total

**6 man-weeks**

### Parallelization

Keystore + policy can run in parallel.

### Risk

Key handling bugs → add +1 mw buffer

---

## Phase 3 — Transaction Engine (Week 3–5)

### Scope

- transfer builder
    
- approve builder
    
- swap builder (single DEX)
    
- RPC abstraction
    
- preflight simulation
    
- risk scoring
    
- receipt watcher
    

### Work Breakdown

Transfer/approve — 1 mw  
Swap builder — 2 mw  
RPC abstraction — 1 mw  
Preflight simulation — 2 mw  
Risk scoring — 1 mw  
Receipt watcher — 1 mw

### Total

**8 man-weeks**

### Critical Path

Swap + preflight

### Risk

DEX integration edge cases → +1–2 mw buffer

---

## Phase 4 — Sandbox Executor (Week 4–6)

### Scope

- container runner
    
- network restrictions
    
- filesystem isolation
    
- process sandboxing
    
- execution tracing
    

### Work Breakdown

Container runner — 2 mw  
Network policies — 1 mw  
FS isolation — 1 mw  
Process restrictions — 1 mw  
Trace system — 1 mw

### Total

**6 man-weeks**

### Parallelization

Runs in parallel with late Phase 3.

### Risk

Sandbox escape bugs → security review required

---

## Phase 5 — Skill Packaging & Registry (Week 5–6)

### Scope

- manifest validation
    
- signed packages
    
- installer
    
- static scanner
    
- curated registry UI (minimal)
    

### Work Breakdown

Manifest validator — 1 mw  
Package signing — 1 mw  
Installer — 1 mw  
Static scanner — 2 mw  
Registry UI — 1 mw

### Total

**6 man-weeks**

---

## Phase 6 — OpenClaw Integration (Week 6–7)

### Scope

- thin skill wrappers
    
- adapter tooling
    
- install scripts
    
- compatibility tests
    

### Work Breakdown

Wrapper skills — 2 mw  
Adapter tooling — 1 mw  
Installer scripts — 1 mw  
Compatibility CI — 1 mw

### Total

**5 man-weeks**

---

## Phase 7 — E2E Integration & Hardening (Week 7–8)

### Scope

- end-to-end flows
    
- security test suite
    
- failure injection
    
- bug fixing
    

### Work Breakdown

E2E test suite — 2 mw  
Security tests — 2 mw  
Bug fixing — 2 mw

### Total

**6 man-weeks**

---

## Phase 8 — Release Candidate (Week 8–9)

### Scope

- packaging
    
- documentation
    
- demo flows
    
- beta release
    

### Work Breakdown

Packaging — 1 mw  
Docs — 1 mw  
Demo environment — 1 mw

### Total

**3 man-weeks**

---

## Summary Table

|Phase|Man-weeks|
|---|---|
|Phase 0|2|
|Phase 1|4|
|Phase 2|6|
|Phase 3|8|
|Phase 4|6|
|Phase 5|6|
|Phase 6|5|
|Phase 7|6|
|Phase 8|3|

**Total: 46 man-weeks**

---

## Realistic Timeline with 2.5 FTE Team

46 mw / 2.5 ≈ **18–20 calendar weeks**

Но из-за параллелизации:

MVP beta можно получить за **8–10 недель**

Production hardening — ещё 4–6 недель.

---

## Critical Path

Wallet → Policy → Swap Engine → Preflight → Approval → E2E

Если это ломается — весь продукт стоит.

---

## Recommended Team Expansion (optional)

Добавление 1 backend engineer снижает timeline до:

**6–7 недель до beta**

---

## Risk Buffers

Crypto edge cases — +2 mw  
Sandbox security — +2 mw  
Integration churn — +1 mw

Итого резерв: **~5 man-weeks**

---

## Final Estimate

Production-ready v0.1:

**~50–52 man-weeks total effort**

MVP beta:

**~30–35 man-weeks**