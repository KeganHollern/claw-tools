# Ethereum Wallet Plugin for OpenClaw

This plugin provides OpenClaw agents with native Web3 capabilities on the Ethereum network.

When installed, your agents can use tools to get their wallet address, check ETH balances, send ETH, read/write smart contracts, and resolve ENS names.

## Prerequisites

1. **OpenClaw** installed and configured on your machine.
2. (Optional) **Ethereum Private Key**: Set via the `ETH_PRIVATE_KEY` environment variable. If not provided, a new key is automatically generated and saved securely at `~/.openclaw/wallet_private_key.txt`.
3. (Optional) **Ethereum RPC URL**: Set via the `ETH_RPC_URL` environment variable. If not provided, defaults to public Ethereum nodes.

## Installation

Since this plugin is hosted as part of the `claw-tools` repository, you can easily install it by cloning the repository and registering the local path with OpenClaw.

1. **Clone the repository:**

   ```bash
   git clone https://github.com/KeganHollern/claw-tools.git
   ```

2. **Navigate to the plugin directory:**

   ```bash
   cd claw-tools/Wallet
   ```

3. **Install dependencies and build the plugin:**

   ```bash
   npm install
   npm run build
   ```

4. **Install the plugin into OpenClaw:**
   Run the OpenClaw plugin installer from within the `Wallet` directory:

   ```bash
   openclaw plugins install .
   ```

   *(Alternatively, use `openclaw plugins install -l .` to install it as a symlink if you plan to modify the code).*

5. **Restart OpenClaw Gateway:**

   ```bash
   openclaw gateway restart
   ```

## Usage

Once installed and the gateway restarts, OpenClaw agents will have an Ethereum wallet configured to interact with the mainnet. You can test the integration by asking an agent:

> "Using your tools, check my current ETH balance, and what's my wallet address?"

### Available Tools

- **`get_wallet_address`**: Get the Ethereum address of the agent's configured wallet.
- **`get_eth_balance`**: Get the ETH balance of a specific address. If no address is provided, returns the agent's configured wallet balance.
- **`send_eth`**: Send ETH to an exact address.
- **`read_contract`**: Call a read-only smart contract function.
- **`write_contract`**: Execute a state-changing transaction on a smart contract.
- **`resolve_ens`**: Resolve an ENS name (e.g. `vitalik.eth`) to its Ethereum address.
- **`get_ens_name_for_address`**: Reverse-resolve an Ethereum address to its primary ENS name.

## Troubleshooting

- **Transactions failing**: Ensure your wallet has enough ETH to cover gas fees. Remember, a generated wallet starts empty!
- **Tools not showing up**: Run `openclaw plugins list` to verify that the wallet plugin is loaded and enabled.
