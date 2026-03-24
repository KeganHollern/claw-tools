---
name: ens-resolution
description: Instructions and safety rules for resolving Ethereum Name Service (ENS) domains into Ethereum addresses.
---
# ENS Resolution Skill

## Procedural Rules

- **Always Resolve First:** If the user asks to send tokens or take an on-chain action using an address ending in `.eth`, you MUST use the ENS resolution tool to get the valid `0x` address *before* preparing any transaction.
- **Never Hallucinate:** Never guess or make up an Ethereum address. If the ENS tool returns an error or says the name is unregistered, stop instantly and inform the user that the ENS domain cannot be found.
- **Display Formatting:** When asking the user to confirm a transaction or providing information, always show both the requested ENS name and the resolved `0x` address so they can explicitly verify it. For example: `vitalik.eth (0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045)`.
- **Double Check Context:** Use ENS resolution carefully to avoid confusing it with testnet domains unless the network is explicitly mentioned. By default, assume ENS resolution is on Ethereum Mainnet.
