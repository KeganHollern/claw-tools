import { Type } from "@sinclair/typebox";
import { createPublicClient, createWalletClient, http, parseAbi, parseEther, formatEther } from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { mainnet } from 'viem/chains';
import * as fs from 'node:fs';
import * as path from 'node:path';
let publicClient;
let walletClient;
let activeAccount;
export function getPublicClient() {
    if (!publicClient)
        throw new Error("Wallet plugin service not started yet");
    return publicClient;
}
export function getWalletClient() {
    if (!walletClient)
        throw new Error("Wallet plugin service not started yet");
    return walletClient;
}
export default function register(api) {
    api.registerService({
        id: "wallet-service",
        start: async (ctx) => {
            let pk = process.env.ETH_PRIVATE_KEY;
            if (!pk) {
                const keyPath = path.join(ctx.stateDir, 'wallet_private_key.txt');
                if (fs.existsSync(keyPath)) {
                    pk = fs.readFileSync(keyPath, 'utf8').trim();
                }
                else {
                    pk = generatePrivateKey();
                    // Ensure the state directory exists
                    if (!fs.existsSync(ctx.stateDir)) {
                        fs.mkdirSync(ctx.stateDir, { recursive: true });
                    }
                    fs.writeFileSync(keyPath, pk, { mode: 0o600 });
                    ctx.logger.info(`Generated new wallet private key at ${keyPath}`);
                }
            }
            let rpcUrl = process.env.ETH_RPC_URL;
            if (!rpcUrl) {
                ctx.logger.warn("ETH_RPC_URL is missing. Defaulting to Cloudflare public provider. Rate limits may apply!");
                rpcUrl = "https://cloudflare-eth.com";
            }
            const transport = http(rpcUrl);
            activeAccount = privateKeyToAccount(pk);
            publicClient = createPublicClient({ chain: mainnet, transport });
            walletClient = createWalletClient({ account: activeAccount, chain: mainnet, transport });
            ctx.logger.info(`Wallet configured. Address: ${activeAccount.address}`);
        }
    });
    api.registerTool({
        name: "get_wallet_address",
        label: "Get Wallet Address",
        description: "Get the Ethereum address of the agent's configured wallet.",
        parameters: Type.Object({}),
        async execute(toolCallId) {
            if (!activeAccount)
                throw new Error("Wallet not initialized");
            return {
                content: [{ type: "text", text: `Your configured Ethereum wallet address is: ${activeAccount.address}` }],
                details: { address: activeAccount.address, toolCallId }
            };
        }
    });
    api.registerTool({
        name: "get_eth_balance",
        label: "Get ETH Balance",
        description: "Get the ETH balance of a specific address. If no address is provided, returns the agent's configured wallet balance.",
        parameters: Type.Object({
            address: Type.Optional(Type.String({ description: "Ethereum address starting with 0x" }))
        }),
        async execute(toolCallId, params) {
            if (!publicClient || !activeAccount)
                throw new Error("Wallet not initialized");
            const targetAddress = (params.address || activeAccount.address);
            const balanceWei = await publicClient.getBalance({ address: targetAddress });
            const balanceEth = formatEther(balanceWei);
            return {
                content: [{ type: "text", text: `Balance of ${targetAddress} is ${balanceEth} ETH` }],
                details: { address: targetAddress, balanceEth, balanceWei: balanceWei.toString(), toolCallId }
            };
        }
    });
    api.registerTool({
        name: "send_eth",
        label: "Send ETH",
        description: "Send ETH to an exact address.",
        parameters: Type.Object({
            to: Type.String({ description: "Recipient Ethereum address" }),
            amountStr: Type.String({ description: "Amount in ETH (as a string, e.g. '0.01')" })
        }),
        async execute(toolCallId, params) {
            if (!walletClient || !activeAccount)
                throw new Error("Wallet not initialized");
            const to = params.to;
            const value = parseEther(params.amountStr);
            const hash = await walletClient.sendTransaction({ to, value });
            return {
                content: [{ type: "text", text: `Successfully sent ${params.amountStr} ETH to ${to}.\nTransaction hash: ${hash}` }],
                details: { txHash: hash, to, amount: params.amountStr, toolCallId }
            };
        }
    });
    api.registerTool({
        name: "read_contract",
        label: "Read Smart Contract",
        description: "Call a read-only smart contract function. Provide the address, human-readable ABI signatures, function name, and arguments array.",
        parameters: Type.Object({
            address: Type.String({ description: "Contract address" }),
            abiSignatures: Type.Array(Type.String(), { description: "Array of human-readable ABI signatures (e.g. ['function balanceOf(address owner) view returns (uint256)'])" }),
            functionName: Type.String({ description: "Name of the function to call" }),
            args: Type.Optional(Type.Array(Type.Any(), { description: "Arguments for the function call" }))
        }),
        async execute(toolCallId, params) {
            if (!publicClient)
                throw new Error("Wallet not initialized");
            const abi = parseAbi(params.abiSignatures);
            const data = await publicClient.readContract({
                address: params.address,
                abi,
                functionName: params.functionName,
                args: params.args
            });
            // serialize BigInts to avoid JSON.stringify errors
            const resultStr = typeof data === 'bigint' ? data.toString() : JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value);
            return {
                content: [{ type: "text", text: `Contract read successful.\nResult: ${resultStr}` }],
                details: { result: resultStr, toolCallId }
            };
        }
    });
    api.registerTool({
        name: "write_contract",
        label: "Write to Smart Contract",
        description: "Execute a state-changing transaction on a smart contract. Provide the address, human-readable ABI signatures, function name, and arguments array.",
        parameters: Type.Object({
            address: Type.String({ description: "Contract address" }),
            abiSignatures: Type.Array(Type.String(), { description: "Array of human-readable ABI signatures (e.g. ['function transfer(address to, uint256 amount) returns (bool)'])" }),
            functionName: Type.String({ description: "Name of the function to call" }),
            args: Type.Optional(Type.Array(Type.Any(), { description: "Arguments for the function call" })),
            valueStr: Type.Optional(Type.String({ description: "Amount of ETH to send along with transaction (as string)" }))
        }),
        async execute(toolCallId, params) {
            if (!walletClient || !publicClient || !activeAccount)
                throw new Error("Wallet not initialized");
            const abi = parseAbi(params.abiSignatures);
            const value = params.valueStr ? parseEther(params.valueStr) : undefined;
            const { request } = await publicClient.simulateContract({
                account: activeAccount,
                address: params.address,
                abi,
                functionName: params.functionName,
                args: params.args,
                value
            });
            const hash = await walletClient.writeContract(request);
            return {
                content: [{ type: "text", text: `Contract write successful!\nTransaction hash: ${hash}` }],
                details: { txHash: hash, toolCallId }
            };
        }
    });
}
