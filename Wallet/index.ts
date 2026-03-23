import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { Type } from "@sinclair/typebox";
import {
    createPublicClient,
    createWalletClient,
    http,
    parseAbi,
    parseEther,
    formatEther,
    type PublicClient,
    type WalletClient,
    type HttpTransport,
    type Chain,
    type Account
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { mainnet } from 'viem/chains';
import * as fs from 'node:fs';
import * as path from 'node:path';

let publicClient: PublicClient<HttpTransport, Chain> | undefined;
let walletClient: WalletClient<HttpTransport, Chain, Account> | undefined;
let activeAccount: Account | undefined;

export function getPublicClient(): PublicClient<HttpTransport, Chain> {
    if (!publicClient) throw new Error("Wallet plugin service not started yet");
    return publicClient;
}

export function getWalletClient(): WalletClient<HttpTransport, Chain, Account> {
    if (!walletClient) throw new Error("Wallet plugin service not started yet");
    return walletClient;
}

export default function register(api: OpenClawPluginApi) {
    api.registerService({
        id: "wallet-service",
        start: async (ctx) => {
            let pk = process.env.ETH_PRIVATE_KEY;
            if (!pk) {
                const keyPath = path.join(ctx.stateDir, 'wallet_private_key.txt');
                if (fs.existsSync(keyPath)) {
                    pk = fs.readFileSync(keyPath, 'utf8').trim();
                } else {
                    pk = generatePrivateKey();
                    if (!fs.existsSync(ctx.stateDir)) {
                        fs.mkdirSync(ctx.stateDir, { recursive: true });
                    }
                    fs.writeFileSync(keyPath, pk, { mode: 0o600 });
                    ctx.logger.info(`Generated new wallet private key at ${keyPath}`);
                }
            }

            let rpcUrl = process.env.ETH_RPC_URL;
            if (!rpcUrl) {
                ctx.logger.warn("ETH_RPC_URL is missing. Defaulting to PublicNode public provider (free, fast, privacy-focused, no API key needed). Rate limits may still apply under heavy usage.");
                rpcUrl = "https://ethereum-rpc.publicnode.com";
            }

            const transport = http(rpcUrl);
            activeAccount = privateKeyToAccount(pk as `0x${string}`);

            publicClient = createPublicClient({ chain: mainnet, transport });
            walletClient = createWalletClient({ account: activeAccount, chain: mainnet, transport });

            ctx.logger.info(`Wallet configured. Address: ${activeAccount.address} | RPC: ${rpcUrl}`);
        }
    });

    // ─────────────────────────────────────────────────────────────
    //  Tools (unchanged except minor description cleanup)
    // ─────────────────────────────────────────────────────────────

    api.registerTool({
        name: "get_wallet_address",
        label: "Get Wallet Address",
        description: "Get the Ethereum address of the agent's configured wallet.",
        parameters: Type.Object({}),
        async execute(toolCallId: string) {
            api.logger.info(`Executing get_wallet_address [${toolCallId}]`);
            if (!activeAccount) {
                api.logger.error(`get_wallet_address [${toolCallId}] failed: Wallet not initialized`);
                throw new Error("Wallet not initialized");
            }
            api.logger.info(`get_wallet_address [${toolCallId}] successful`);
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
        async execute(toolCallId: string, params: any) {
            api.logger.info(`Executing get_eth_balance [${toolCallId}] for address: ${params.address || 'self'}`);
            if (!publicClient || !activeAccount) {
                api.logger.error(`get_eth_balance [${toolCallId}] failed: Wallet not initialized`);
                throw new Error("Wallet not initialized");
            }
            const targetAddress = (params.address || activeAccount.address) as `0x${string}`;
            const balanceWei = await publicClient.getBalance({ address: targetAddress });
            const balanceEth = formatEther(balanceWei);
            api.logger.info(`get_eth_balance [${toolCallId}] successful: ${balanceEth} ETH`);
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
        async execute(toolCallId: string, params: any) {
            api.logger.info(`Executing send_eth [${toolCallId}] to send ${params.amountStr} ETH to ${params.to}`);
            if (!walletClient || !activeAccount) {
                api.logger.error(`send_eth [${toolCallId}] failed: Wallet not initialized`);
                throw new Error("Wallet not initialized");
            }
            const to = params.to as `0x${string}`;
            const value = parseEther(params.amountStr);
            const hash = await walletClient.sendTransaction({ to, value });
            api.logger.info(`send_eth [${toolCallId}] successful. Tx hash: ${hash}`);
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
        async execute(toolCallId: string, params: any) {
            api.logger.info(`Executing read_contract [${toolCallId}] on ${params.address} for ${params.functionName}`);
            if (!publicClient) {
                api.logger.error(`read_contract [${toolCallId}] failed: Wallet not initialized`);
                throw new Error("Wallet not initialized");
            }
            const abi = parseAbi(params.abiSignatures as string[]);
            const data = await publicClient.readContract({
                address: params.address as `0x${string}`,
                abi,
                functionName: params.functionName,
                args: params.args as any[] | undefined
            });
            const resultStr = typeof data === 'bigint'
                ? data.toString()
                : JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value);
            api.logger.info(`read_contract [${toolCallId}] successful. Result: ${resultStr}`);
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
        async execute(toolCallId: string, params: any) {
            api.logger.info(`Executing write_contract [${toolCallId}] on ${params.address} for ${params.functionName}`);
            if (!walletClient || !publicClient || !activeAccount) {
                api.logger.error(`write_contract [${toolCallId}] failed: Wallet not initialized`);
                throw new Error("Wallet not initialized");
            }
            const abi = parseAbi(params.abiSignatures as string[]);
            const value = params.valueStr ? parseEther(params.valueStr) : undefined;

            const { request } = await publicClient.simulateContract({
                account: activeAccount,
                address: params.address as `0x${string}`,
                abi,
                functionName: params.functionName,
                args: params.args as any[] | undefined,
                value
            });

            const hash = await walletClient.writeContract(request);
            api.logger.info(`write_contract [${toolCallId}] successful. Tx hash: ${hash}`);
            return {
                content: [{ type: "text", text: `Contract write successful!\nTransaction hash: ${hash}` }],
                details: { txHash: hash, toolCallId }
            };
        }
    });
}