# Architecture Diagrams (Textual)

## Component Diagram

OpenClaw Skill  
→ ISCL Adapter  
→ ISCL Core API  
→ Policy Engine  
→ Wallet Service  
→ RPC Network

Sandbox Executor runs isolated skill code and talks only to ISCL Core.

## Sequence — Safe Swap

User → OpenClaw Skill  
Skill → ISCL /tx/build  
ISCL → RPC simulate  
ISCL → Approval Request  
User confirms  
ISCL signs tx  
ISCL sends tx  
Receipt logged

## Security Boundary Diagram

[OpenClaw Domain] → (API boundary) → [ISCL Core] → (IPC boundary) → [Sandbox Executor]

Keys exist only inside ISCL Core.