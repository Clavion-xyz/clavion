# @clavion/cli

Key management CLI for Clavion. Import, generate, and list encrypted keystore
entries. Keys are stored using scrypt + AES-256-GCM encryption.

## Commands

```
clavion-cli key import            -- Import private key from stdin
clavion-cli key import-mnemonic   -- Import from BIP-39 mnemonic
clavion-cli key generate          -- Generate new random key
clavion-cli key list              -- List keystore addresses
```

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--keystore-path <dir>` | `~/.iscl/keystore` | Override keystore directory |
| `--account-index <n>` | `0` | BIP-44 account index (mnemonic import) |
| `--address-index <n>` | `0` | BIP-44 address index (mnemonic import) |

## Examples

```bash
# Import a private key
echo "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" \
  | clavion-cli key import

# Import from mnemonic with custom derivation
echo "test test test test test test test test test test test junk" \
  | clavion-cli key import-mnemonic --account-index 1

# Generate a new key
clavion-cli key generate

# List all keys
clavion-cli key list
```

All key operations prompt for a passphrase. Import and generate operations log
an audit event (address only, never the key material).

## Project Root

[Back to main README](../../README.md)
