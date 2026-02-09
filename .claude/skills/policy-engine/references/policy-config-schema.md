# Policy Configuration Schema

## YAML Config Structure (~/.iscl/policy.yaml)

```yaml
# Policy version — tracked in audit trace
version: "1"

# --- Value Limits ---
# Maximum transaction value in wei (string). Deny if exceeded.
maxValueWei: "1000000000000000000"  # 1 ETH

# Maximum ERC20 approval amount (string). Deny MaxUint approvals.
maxApprovalAmount: "1000000000"

# --- Allowlists ---
# Only these contract addresses can be interacted with.
# Empty list = deny all contract interactions.
contractAllowlist:
  - "0x2626664c2603336E57B271c5C0b26F421741e481"  # Uniswap V3 Router (Base)

# Only these token addresses are permitted in actions.
tokenAllowlist:
  - "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"  # USDC (Base)
  - "0x4200000000000000000000000000000000000006"    # WETH (Base)

# Allowed chain IDs. Deny intents for other chains.
allowedChains:
  - 8453  # Base

# Optional: restrict transfer recipients
recipientAllowlist: []  # empty = any recipient allowed

# --- Risk Thresholds ---
# Maximum acceptable risk score from preflight (0-100).
# Above this → require_approval even if other checks pass.
maxRiskScore: 70

# --- Approval Thresholds ---
# Require human approval for transactions above this value.
requireApprovalAbove:
  valueWei: "100000000000000000"  # 0.1 ETH

# --- Rate Limits ---
# Maximum transactions per hour. Deny if exceeded.
maxTxPerHour: 20

# --- Approval Token Settings ---
approvalToken:
  ttlSeconds: 300       # 5 minutes
  singleUse: true       # always true, non-configurable in v0.1
```

## Validation Rules for Config

- `version` must be present and string
- All wei amounts must be non-negative integer strings
- All addresses must be valid checksummed 0x addresses
- `allowedChains` must be non-empty array of positive integers
- `maxRiskScore` must be 0–100
- `maxTxPerHour` must be positive integer
- Unknown keys are rejected (strict parsing)

## Default Behavior When Config Keys Are Missing

| Missing Key | Default Behavior |
|---|---|
| `maxValueWei` | Deny all value transfers |
| `maxApprovalAmount` | Deny all approvals |
| `contractAllowlist` | Deny all contract interactions |
| `tokenAllowlist` | Deny all token actions |
| `allowedChains` | Deny all chains |
| `maxRiskScore` | 50 (conservative) |
| `requireApprovalAbove` | Require approval for everything |
| `maxTxPerHour` | 10 |

Conservative defaults = fail-safe. Missing config should never result in permissive behavior.
