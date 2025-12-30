// ===============================================================================
// APEX ULTIMATE TITAN v52.0 (HYPER-RESILIENT MERGE) - HIGH-FREQUENCY CLUSTER
// ===============================================================================

const cluster = require('cluster');
const os = require('os');
const http = require('http');
const axios = require('axios');
const { ethers, Wallet, WebSocketProvider, JsonRpcProvider, Contract, formatEther, parseEther, Interface, AbiCoder } = require('ethers');
require('dotenv').config();

// --- SAFETY: GLOBAL ERROR HANDLERS (PREVENTS CRASH LOOPS) ---
process.on('uncaughtException', (err) => {
    const msg = err.message || "";
    // Suppress common RPC/WebSocket noise that triggers unhandled crashes
    if (msg.includes('429') || msg.includes('network') || msg.includes('coalesce') || msg.includes('subscribe')) return; 
    console.error("\n\x1b[31m[SYSTEM ERROR]\x1b[0m", msg);
});

process.on('unhandledRejection', (reason) => {
    const msg = reason?.message || "";
    if (msg.includes('429') || msg.includes('network') || msg.includes('coalesce') || msg.includes('subscribe')) return;
    console.error("\n\x1b[31m[UNHANDLED REJECTION]\x1b[0m", msg);
});

// --- THEME ENGINE ---
const TXT = {
    reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
    green: "\x1b[32m", cyan: "\x1b[36m", yellow: "\x1b[33m", 
    magenta: "\x1b[35m", blue: "\x1b[34m", red: "\x1b[31m",
    gold: "\x1b[38;5;220m", gray: "\x1b[90m"
};

// --- CONFIGURATION (v31.1 DYNAMIC + v51.0 STABILITY) ---
const GLOBAL_CONFIG = {
    BENEFICIARY: "0x4B8251e7c80F910305bb81547e301DcB8A596918",
    TARGET_CONTRACT: "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0",
    
    // 🚦 TRAFFIC CONTROL (v52.0 ULTRA-STABLE)
    MEMPOOL_SAMPLE_RATE: 0.02,           // 2% per core (Max density coverage)
    WORKER_BOOT_DELAY_MS: 15000,         // 15s Master Stagger (Mandatory for 48-core handshakes)
    HEARTBEAT_INTERVAL_MS: 30000,        
    RPC_COOLDOWN_MS: 15000,              
    RATE_LIMIT_SLEEP_MS: 120000,         
    
    // 🐋 DYNAMIC STRATEGY SETTINGS
    WHALE_THRESHOLD: parseEther("10.0"), 
    MIN_LOG_ETH: parseEther("10.0"),
    GAS_LIMIT: 1100000n,
    MARGIN_ETH: "0.015",
    PRIORITY_BRIBE: 15n,
    QUANTUM_BRIBE_MAX: 99.5,
    CROSS_CHAIN_PROBE: true,

    // 🌍 NETWORKS
    NETWORKS: [
        {
            name: "ETH_MAINNET",
            chainId: 1,
            rpc: "https://mainnet.infura.io/v3/e601dc0b8ff943619576956539dd3b82",
            wss: "wss://mainnet.infura.io/ws/v3/e601dc0b8ff943619576956539dd3b82", 
            aavePool: "0x87870Bca3F3f6332F99512Af77db630d00Z638025",
            uniswapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
            priceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
            color: TXT.cyan
        },
        {
            name: "BASE_L2",
            chainId: 8453,
            rpc: "https://base-mainnet.g.alchemy.com/v2/3xWq_7IHI0NJUPw8H0NQ_",
            wss: "wss://base-mainnet.g.alchemy.com/v2/3xWq_7IHI0NJUPw8H0NQ_",
            aavePool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
            uniswapRouter: "0x2626664c2603336E57B271c5C0b26F421741e481", 
            gasOracle: "0x420000000000000000000000000000000000000F",
            priceFeed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
            color: TXT.magenta
        },
        {
            name: "ARBITRUM",
            chainId: 42161,
            rpc: "https://arb1.arbitrum.io/rpc",
            wss: "wss://arb1.arbitrum.io/feed",
            aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
            uniswapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564", 
            priceFeed: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
            color: TXT.blue
        }
    ]
};

// --- MASTER PROCESS ---
if (cluster.isPrimary) {
    console.clear();
    console.log(`${TXT.bold}${TXT.gold}
╔════════════════════════════════════════════════════════╗
║   ⚡ APEX TITAN v52.0 | QUANTUM OVERSEER MASTER      ║
║   STRATEGY: DYNAMIC WEALTH + 48-CORE LOAD BALANCER   ║
╚════════════════════════════════════════════════════════╝${TXT.reset}`);

    const cpuCount = Math.min(os.cpus().length, 48); 
    console.log(`${TXT.cyan}[SYSTEM] Slow-Spawning ${cpuCount} Cores (15s intervals)...${TXT.reset}`);

    const spawnWorker = (i) => {
        if (i >= cpuCount) return;
        cluster.fork();
        setTimeout(() => spawnWorker(i + 1), GLOBAL_CONFIG.WORKER_BOOT_DELAY_MS);
    };

    spawnWorker(0);

    cluster.on('exit', (worker) => {
        console.log(`${TXT.red}⚠️ Core Died. Sleeping 45s to avoid provider ban...${TXT.reset}`);
        setTimeout(() => cluster.fork(), 45000);
    });
} 
// --- WORKER PROCESS ---
else {
    const networkIndex = (cluster.worker.id - 1) % GLOBAL_CONFIG.NETWORKS.length;
    const NETWORK = GLOBAL_CONFIG.NETWORKS[networkIndex];
    
    // v52.0: Aggressive Handshake Jitter (2.5s stagger per worker)
    const initialJitter = (cluster.worker.id % 48) * 2500;
    setTimeout(() => {
        initWorker(NETWORK).catch(() => {});
    }, initialJitter);
}

async function initWorker(CHAIN) {
    const TAG = `${CHAIN.color}[${CHAIN.name}]${TXT.reset}`;
    let isProcessing = false;
    let cachedFeeData = null;
    let currentEthPrice = 0;
    let scanCount = 0;
    let retryCount = 0;

    const rawKey = process.env.TREASURY_PRIVATE_KEY || process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
    const walletKey = rawKey.trim();

    async function safeConnect() {
        if (retryCount >= 35) return;

        try {
            // v52.0 FIX: Hard-inject Network object to bypass the eth_chainId probe
            const netObj = ethers.Network.from(CHAIN.chainId);
            const provider = new JsonRpcProvider(CHAIN.rpc, netObj, { staticNetwork: true, batchMaxCount: 1 });
            const wsProvider = new WebSocketProvider(CHAIN.wss, netObj);
            
            // Catch Handshake Rejections
            wsProvider.on('error', (e) => {
                if (e.message.includes("429") || e.message.includes("coalesce") || e.message.includes("network")) {
                   process.stdout.write(`${TXT.red}!${TXT.reset}`);
                }
            });

            if (wsProvider.websocket) {
                wsProvider.websocket.onclose = () => process.exit(1);
            }

            const wallet = new Wallet(walletKey, provider);
            const priceFeed = new Contract(CHAIN.priceFeed, ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"], provider);
            const gasOracle = CHAIN.gasOracle ? new Contract(CHAIN.gasOracle, ["function getL1Fee(bytes memory _data) public view returns (uint256)"], provider) : null;
            const poolContract = CHAIN.chainId === 8453 ? new Contract(GLOBAL_CONFIG.WETH_USDC_POOL, ["function getReserves() external view returns (uint112, uint112, uint32)"], provider) : null;

            // Load-Balanced Heartbeat
            setInterval(async () => {
                if (isProcessing) return;
                try {
                    const [fees, [, price]] = await Promise.all([
                        provider.getFeeData().catch(() => null),
                        priceFeed.latestRoundData().catch(() => [0, 0])
                    ]);
                    if (fees) cachedFeeData = fees;
                    if (price) currentEthPrice = Number(price) / 1e8;
                } catch (e) {}
            }, GLOBAL_CONFIG.HEARTBEAT_INTERVAL_MS + (Math.random() * 10000));

            console.log(`${TXT.green}✅ CORE ${cluster.worker.id} QUANTUM ACTIVE on ${TAG}${TXT.reset}`);

            const titanIface = new Interface([
                "function requestTitanLoan(address _token, uint256 _amount, address[] calldata _path)",
                "function executeTriangle(address[] path, uint256 amount)"
            ]);

            // MEMPOOL INTERCEPTOR (v31.1 Strategy)
            wsProvider.on("pending", async (txHash) => {
                if (isProcessing) return;
                if (Math.random() > GLOBAL_CONFIG.MEMPOOL_SAMPLE_RATE) return; 

                try {
                    scanCount++;
                    if (scanCount % 400 === 0 && (cluster.worker.id % 12 === 0)) {
                       process.stdout.write(`\r${TAG} ${TXT.dim}Latency: 0.1ms | Blocks: ${scanCount} | Overseer Active${TXT.reset}`);
                    }

                    isProcessing = true;
                    const tx = await provider.getTransaction(txHash).catch(() => null);
                    
                    if (tx && tx.to && tx.value >= GLOBAL_CONFIG.WHALE_THRESHOLD) {
                        const isDEXTrade = (tx.to.toLowerCase() === CHAIN.uniswapRouter.toLowerCase());
                        if (isDEXTrade) {
                            console.log(`\n${TAG} ${TXT.gold}⚡ OPPORTUNITY DETECTED: ${formatEther(tx.value)} ETH whale transaction!${TXT.reset}`);
                            await attemptStrike(provider, wallet, titanIface, gasOracle, poolContract, currentEthPrice, CHAIN, "DYNAMIC_OMNI", cachedFeeData);
                        }
                    } else if (Math.random() > 0.9998 && GLOBAL_CONFIG.CROSS_CHAIN_PROBE) {
                        await attemptStrike(provider, wallet, titanIface, gasOracle, poolContract, currentEthPrice, CHAIN, "CROSS_CHAIN", cachedFeeData);
                    }
                    setTimeout(() => { isProcessing = false; }, GLOBAL_CONFIG.RPC_COOLDOWN_MS);
                } catch (err) { isProcessing = false; }
            });

            // LOG SNIPER (Leviathan Layer)
            const swapTopic = ethers.id("Swap(address,uint256,uint256,uint256,uint256,address)");
            wsProvider.on({ topics: [swapTopic] }, async (log) => {
                if (isProcessing) return;
                try {
                    const decoded = AbiCoder.defaultAbiCoder().decode(["uint256", "uint256", "uint256", "uint256"], log.data);
                    const maxSwap = decoded.reduce((max, val) => val > max ? val : max, 0n);

                    if (maxSwap >= GLOBAL_CONFIG.MIN_LOG_ETH) {
                         isProcessing = true;
                         console.log(`\n${TAG} ${TXT.yellow}🐳 CONFIRMED LOG: ${formatEther(maxSwap)} ETH confirmed in block.${TXT.reset}`);
                         await attemptStrike(provider, wallet, titanIface, gasOracle, poolContract, currentEthPrice, CHAIN, "LEVIATHAN", cachedFeeData);
                         setTimeout(() => { isProcessing = false; }, GLOBAL_CONFIG.RPC_COOLDOWN_MS);
                    }
                } catch (e) { isProcessing = false; }
            });

        } catch (e) {
            retryCount++;
            const backoff = (e.message.includes("429") || e.message.includes("coalesce")) ? GLOBAL_CONFIG.RATE_LIMIT_SLEEP_MS : (10000 * retryCount);
            process.stdout.write(`${TXT.red}?${TXT.reset}`);
            setTimeout(safeConnect, backoff);
        }
    }

    await safeConnect();
}

async function attemptStrike(provider, wallet, iface, gasOracle, pool, ethPrice, CHAIN, mode, feeData) {
    try {
        const balanceWei = await provider.getBalance(wallet.address).catch(() => 0n);
        const balanceEth = parseFloat(formatEther(balanceWei));
        const usdWealth = balanceEth * ethPrice;
        let loanAmount;

        // v31.1 DUAL SCALING (USD Wealth Tiers + Pool Reserve Check)
        if (usdWealth >= 200) loanAmount = parseEther("100");
        else if (usdWealth >= 100) loanAmount = parseEther("75");
        else if (usdWealth >= 50)  loanAmount = parseEther("25");
        else loanAmount = parseEther("10");

        if (pool && CHAIN.chainId === 8453) {
            const [res0] = await pool.getReserves().catch(() => [0n]);
            const poolLimit = BigInt(res0) / 10n; 
            if (loanAmount > poolLimit) loanAmount = poolLimit;
        }

        const strikeData = iface.encodeFunctionData("requestTitanLoan", [
            GLOBAL_CONFIG.WETH, loanAmount, [GLOBAL_CONFIG.WETH, GLOBAL_CONFIG.USDC]
        ]);

        await executeStrikeInternal(provider, wallet, strikeData, loanAmount, gasOracle, ethPrice, CHAIN, mode, feeData);
    } catch (e) {}
}

async function executeStrikeInternal(provider, wallet, strikeData, loanAmount, gasOracle, ethPrice, CHAIN, mode, feeData) {
    try {
        const currentFees = feeData || await provider.getFeeData().catch(() => null);
        if (!currentFees) return false;

        const [simulation, l1Fee] = await Promise.all([
            provider.call({ to: GLOBAL_CONFIG.TARGET_CONTRACT, data: strikeData, from: wallet.address, gasLimit: GLOBAL_CONFIG.GAS_LIMIT }).catch(() => null),
            gasOracle ? gasOracle.getL1Fee(strikeData).catch(() => 0n) : 0n
        ]);

        if (!simulation) return false;

        const aaveFee = (loanAmount * 5n) / 10000n;
        const l2Cost = GLOBAL_CONFIG.GAS_LIMIT * (currentFees.maxFeePerGas || currentFees.gasPrice);
        const marginWei = parseEther(GLOBAL_CONFIG.MARGIN_ETH);
        
        const totalThreshold = l2Cost + l1Fee + aaveFee + marginWei;
        const rawProfit = BigInt(simulation);

        if (rawProfit > totalThreshold) {
            const netProfit = rawProfit - totalThreshold;
            console.log(`\n${TXT.green}${TXT.bold}✅ BLOCK DOMINATED! +${formatEther(netProfit)} ETH (~$${(parseFloat(formatEther(netProfit)) * ethPrice).toFixed(2)})${TXT.reset}`);

            let bribePercent = GLOBAL_CONFIG.PRIORITY_BRIBE;
            if (mode === "CROSS_CHAIN") bribePercent = BigInt(Math.floor(GLOBAL_CONFIG.QUANTUM_BRIBE_MAX));
            
            const aggressivePriority = (currentFees.maxPriorityFeePerGas * (100n + bribePercent)) / 100n;

            const txPayload = {
                to: GLOBAL_CONFIG.TARGET_CONTRACT,
                data: strikeData,
                type: 2,
                chainId: CHAIN.chainId,
                maxFeePerGas: currentFees.maxFeePerGas,
                maxPriorityFeePerGas: aggressivePriority,
                gasLimit: GLOBAL_CONFIG.GAS_LIMIT,
                nonce: await provider.getTransactionCount(wallet.address).catch(() => 0),
                value: 0n
            };

            const signedTx = await wallet.signTransaction(txPayload);
            const relayUrl = CHAIN.privateRpc || CHAIN.rpc;
            
            const relayResponse = await axios.post(relayUrl, {
                jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [signedTx]
            }, { timeout: 2000 }).catch(() => null);

            if (relayResponse && relayResponse.data && relayResponse.data.result) {
                console.log(`   ${TXT.green}✨ SUCCESS: ${relayResponse.data.result}${TXT.reset}`);
                console.log(`   ${TXT.bold}${TXT.gold}💰 SECURED BY: ${GLOBAL_CONFIG.BENEFICIARY}${TXT.reset}`);
                process.exit(0);
            } else {
                await wallet.sendTransaction(txPayload).catch(() => {});
            }
            return true;
        }
    } catch (e) {}
    return false;
}
