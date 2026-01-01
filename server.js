// ===============================================================================
// APEX TITAN DYNAMIC v17.2 (MERGED) - HIGH-FREQUENCY SCALING CLUSTER
// ===============================================================================
// FIXED: TRANSACTION EXECUTION ENGINE + NONCE SYNC + MULTI-CHANNEL BROADCAST
// TARGET BENEFICIARY: 0x4B8251e7c80F910305bb81547e301DcB8A596918
// ===============================================================================

const cluster = require('cluster');
const os = require('os');
const http = require('http');
const axios = require('axios');
const { ethers, WebSocketProvider, JsonRpcProvider, Wallet, Interface, parseEther, formatEther, Contract, FallbackProvider } = require('ethers');
require('dotenv').config();

// --- SAFETY: GLOBAL ERROR HANDLERS ---
process.on('uncaughtException', (err) => {
    const msg = err.message || "";
    if (msg.includes('200') || msg.includes('429') || msg.includes('network')) return;
    console.error("\n\x1b[31m[CRITICAL ERROR]\x1b[0m", msg);
});

process.on('unhandledRejection', (reason) => {
    const msg = reason?.message || reason || "";
    if (msg.toString().includes('200') || msg.toString().includes('429')) return;
});

// --- DEPENDENCY CHECK ---
let FlashbotsBundleProvider;
let hasFlashbots = false;
try {
    ({ FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle'));
    hasFlashbots = true;
} catch (e) {
    if (cluster.isPrimary) console.error("\x1b[33m%s\x1b[0m", "\n⚠️ WARNING: Flashbots dependency missing. Mainnet bundling disabled.");
}

// --- THEME ENGINE ---
const TXT = {
    reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
    green: "\x1b[32m", cyan: "\x1b[36m", yellow: "\x1b[33m", 
    magenta: "\x1b[35m", blue: "\x1b[34m", red: "\x1b[31m",
    gold: "\x1b[38;5;220m", gray: "\x1b[90m"
};

// --- CONFIGURATION ---
const GLOBAL_CONFIG = {
    TARGET_CONTRACT: process.env.TARGET_CONTRACT || "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0", 
    BENEFICIARY: process.env.BENEFICIARY || "0x4B8251e7c80F910305bb81547e301DcB8A596918",
    
    // STRATEGY SETTINGS
    MIN_WHALE_VALUE: 0.1,                // ULTRA-SENSITIVE: Detect transactions >= 0.1 ETH
    GAS_LIMIT: 1250000n,                 // Optimal buffer for dynamic loans
    PORT: process.env.PORT || 8080,
    MIN_NET_PROFIT: "0.0005",            // Striking floor (~$1.50)
    PRIORITY_BRIBE: 25n,                 // 25% Tip for block priority (Aggressive)

    NETWORKS: [
        {
            name: "ETH_MAINNET", chainId: 1,
            rpc: process.env.ETH_RPC || "https://eth.llamarpc.com",
            wss: process.env.ETH_WSS || "wss://ethereum-rpc.publicnode.com", 
            type: "FLASHBOTS", relay: "https://relay.flashbots.net",
            aavePool: "0x87870Bca3F3f6332F99512Af77db630d00Z638025",
            uniswapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
            priceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
            weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
            color: TXT.cyan
        },
        {
            name: "ARBITRUM", chainId: 42161,
            rpc: process.env.ARB_RPC || "https://arb1.arbitrum.io/rpc",
            wss: process.env.ARB_WSS || "wss://arb1.arbitrum.io/feed",
            type: "PRIVATE_RELAY",
            aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
            uniswapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564", 
            priceFeed: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
            weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
            color: TXT.blue
        },
        {
            name: "BASE_MAINNET", chainId: 8453,
            rpc: process.env.BASE_RPC || "https://mainnet.base.org",
            wss: process.env.BASE_WSS || "wss://base-rpc.publicnode.com",
            privateRpc: "https://base.merkle.io",
            aavePool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
            uniswapRouter: "0x2626664c2603336E57B271c5C0b26F421741e481", 
            gasOracle: "0x420000000000000000000000000000000000000F",
            priceFeed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
            weth: "0x4200000000000000000000000000000000000006",
            color: TXT.magenta
        }
    ]
};

// --- MASTER PROCESS ---
if (cluster.isPrimary) {
    console.clear();
    console.log(`${TXT.bold}${TXT.gold}╔════════════════════════════════════════════════════════╗${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}║   ⚡ APEX TITAN DYNAMIC v17.2 | CLUSTER EXECUTION     ║${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}║   MODE: WEALTH-SCALED LOANS + NUCLEAR BROADCAST      ║${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}╚════════════════════════════════════════════════════════╝${TXT.reset}\n`);

    const cpuCount = Math.min(os.cpus().length, 32);
    console.log(`${TXT.green}[SYSTEM] Spawning ${cpuCount} Quantum Workers...${TXT.reset}`);
    console.log(`${TXT.magenta}[TARGET] Beneficiary: ${GLOBAL_CONFIG.BENEFICIARY}${TXT.reset}\n`);
    
    for (let i = 0; i < cpuCount; i++) cluster.fork();

    cluster.on('exit', (worker) => {
        console.log(`${TXT.red}⚠️ Worker died. Respawning...${TXT.reset}`);
        setTimeout(() => cluster.fork(), 2000);
    });
} 
// --- WORKER PROCESS ---
else {
    const networkIndex = (cluster.worker.id - 1) % GLOBAL_CONFIG.NETWORKS.length;
    const NETWORK = GLOBAL_CONFIG.NETWORKS[networkIndex];
    initWorker(NETWORK);
}

async function initWorker(CHAIN) {
    const TAG = `${CHAIN.color}[${CHAIN.name}]${TXT.reset}`;
    let currentEthPrice = 0;
    let scanCount = 0;

    const rawKey = process.env.PRIVATE_KEY || "";
    if (!rawKey) return;

    async function connect() {
        try {
            const network = ethers.Network.from(CHAIN.chainId);
            const provider = new JsonRpcProvider(CHAIN.rpc, network, { staticNetwork: true });
            const wsProvider = new WebSocketProvider(CHAIN.wss, network);
            const wallet = new Wallet(rawKey.trim(), provider);
            
            const priceFeed = CHAIN.priceFeed ? new Contract(CHAIN.priceFeed, ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"], provider) : null;
            const gasOracle = CHAIN.gasOracle ? new Contract(CHAIN.gasOracle, ["function getL1Fee(bytes memory _data) public view returns (uint256)"], provider) : null;

            if (priceFeed) {
                const updatePrice = async () => {
                    try {
                        const [, price] = await priceFeed.latestRoundData();
                        currentEthPrice = Number(price) / 1e8;
                    } catch (e) {}
                };
                await updatePrice();
                setInterval(updatePrice, 30000);
            }

            console.log(`${TXT.green}✅ CORE ${cluster.worker.id} ACTIVE on ${CHAIN.name}${TXT.reset}`);

            const poolIface = new Interface([
                "function flashLoanSimple(address receiverAddress, address asset, uint256 amount, bytes calldata params, uint16 referralCode)"
            ]);

            // MEMPOOL DETECTION
            wsProvider.on("pending", async (txHash) => {
                try {
                    scanCount++;
                    if (scanCount % 50 === 0) {
                        process.stdout.write(`\r${TAG} ${TXT.dim}Mempool Scanning... (${scanCount}) | ETH: $${currentEthPrice.toFixed(2)}${TXT.reset}`);
                    }

                    const tx = await provider.getTransaction(txHash).catch(() => null);
                    if (!tx || !tx.to || !tx.value) return;

                    const valueEth = parseFloat(formatEther(tx.value));
                    
                    // Filter for Uniswap/Router activity or High Value transfers
                    if (valueEth >= GLOBAL_CONFIG.MIN_WHALE_VALUE && 
                        tx.to.toLowerCase() === CHAIN.uniswapRouter.toLowerCase()) {

                        console.log(`\n${TAG} ${TXT.gold}⚡ WHALE SIGNAL: ${txHash.substring(0, 12)}... [${valueEth.toFixed(2)} ETH]${TXT.reset}`);

                        // 1. DYNAMIC WEALTH SCALING
                        const balanceEth = parseFloat(formatEther(await provider.getBalance(wallet.address)));
                        const usdValue = balanceEth * currentEthPrice;

                        let loanAmount = parseEther("10"); 
                        if (usdValue >= 500) loanAmount = parseEther("100");
                        else if (usdValue >= 200) loanAmount = parseEther("50");
                        else if (usdValue >= 100) loanAmount = parseEther("25");

                        const tradeData = poolIface.encodeFunctionData("flashLoanSimple", [
                            GLOBAL_CONFIG.TARGET_CONTRACT,
                            CHAIN.weth, 
                            loanAmount,
                            "0x", 
                            0
                        ]);

                        // 2. PRE-FLIGHT & PROFIT CHECK
                        const [simulation, l1Fee, feeData, nonce] = await Promise.all([
                            provider.call({ to: CHAIN.aavePool, data: tradeData, from: wallet.address, gasLimit: GLOBAL_CONFIG.GAS_LIMIT }).catch(() => null),
                            gasOracle ? gasOracle.getL1Fee(tradeData).catch(() => 0n) : 0n,
                            provider.getFeeData(),
                            provider.getTransactionCount(wallet.address, 'latest')
                        ]);

                        if (!simulation || simulation === "0x") return;

                        // Calculate threshold
                        const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || parseEther("1", "gwei");
                        const l2Cost = GLOBAL_CONFIG.GAS_LIMIT * gasPrice;
                        const totalCost = l2Cost + l1Fee + parseEther(GLOBAL_CONFIG.MIN_NET_PROFIT);
                        
                        // Treat return value as profit if applicable
                        const projectedProfit = BigInt(simulation); 

                        if (projectedProfit > totalCost) {
                            console.log(`${TAG} ${TXT.green}💰 SIMULATED PROFIT: ${formatEther(projectedProfit - (l2Cost + l1Fee))} ETH. STRIKING...${TXT.reset}`);

                            const priority = (feeData.maxPriorityFeePerGas || 0n) * (100n + GLOBAL_CONFIG.PRIORITY_BRIBE) / 100n;
                            const txPayload = {
                                to: CHAIN.aavePool,
                                data: tradeData,
                                type: 2,
                                chainId: CHAIN.chainId,
                                maxFeePerGas: (feeData.maxFeePerGas || 0n) + priority,
                                maxPriorityFeePerGas: priority,
                                gasLimit: GLOBAL_CONFIG.GAS_LIMIT,
                                nonce: nonce,
                                value: 0n
                            };

                            // 3. NUCLEAR BROADCAST (Multi-Channel)
                            if (CHAIN.type === "FLASHBOTS" && hasFlashbots) {
                                const authSigner = new Wallet(wallet.privateKey, provider);
                                const fb = await FlashbotsBundleProvider.create(provider, authSigner, CHAIN.relay);
                                const signed = await wallet.signTransaction(txPayload);
                                fb.sendBundle([{ signedTransaction: signed }], (await provider.getBlockNumber()) + 1);
                            } else {
                                // Channel A: Standard Provider (Reliable)
                                wallet.sendTransaction(txPayload).then(res => {
                                    console.log(`${TXT.green}🚀 TX SENT: ${res.hash}${TXT.reset}`);
                                }).catch(e => {
                                    if (!e.message.includes("nonce")) console.error(`${TXT.red}Fail: ${e.message.substring(0,40)}...${TXT.reset}`);
                                });

                                // Channel B: Direct RPC Push (Speed)
                                const signedTx = await wallet.signTransaction(txPayload);
                                axios.post(CHAIN.privateRpc || CHAIN.rpc, {
                                    jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [signedTx]
                                }, { timeout: 3000 }).catch(() => {});
                            }
                        }
                    }
                } catch (err) {}
            });

        } catch (e) {
            setTimeout(connect, 5000);
        }
    }
    connect();
}
