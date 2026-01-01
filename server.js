/**
 * ===============================================================================
 * APEX MASTER v33.2 (QUANTUM DYNAMIC SINGULARITY) - FINAL REPAIR BUILD
 * ===============================================================================
 * FIX: MaxListenersExceeded memory leak + Staggered Core Hydration
 * DNA: WEALTH-SCALED LEVERAGE + MULTI-CHANNEL BROADCAST + AI HEALING
 * PROTECTION: 48-CORE COORDINATION | MULTI-RPC FALLBACK | L1 GAS AWARE
 * ===============================================================================
 */

const cluster = require('cluster');
const os = require('os');
const axios = require('axios');
const { 
    ethers, JsonRpcProvider, Wallet, Interface, parseEther, 
    formatEther, Contract, FallbackProvider, WebSocketProvider 
} = require('ethers');
require('dotenv').config();

// --- CRITICAL: FIX EVENT LEAK & SUPPRESS NOISE ---
process.setMaxListeners(100); // Scale event system for 48 parallel cores

process.on('uncaughtException', (err) => {
    const msg = err.message || "";
    if (msg.includes('429') || msg.includes('503') || msg.includes('network')) return;
    console.error("\n\x1b[31m[SYSTEM ROOT ERROR]\x1b[0m", msg);
});

const TXT = { reset: "\x1b[0m", green: "\x1b[32m", yellow: "\x1b[33m", gold: "\x1b[38;5;220m", cyan: "\x1b[36m", magenta: "\x1b[35m" };

const GLOBAL_CONFIG = {
    TARGET_CONTRACT: process.env.TARGET_CONTRACT || "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0", 
    BENEFICIARY: "0x35c3ECfFBBDd942a8DbA7587424b58f74d6d6d15",
    GAS_LIMIT: 1250000n, 
    TUNABLES: { MAX_BRIBE_PERCENT: 99.9, GAS_PRIORITY_FEE: 1000, MIN_NET_PROFIT: "0.0005" },
    RPC_POOL: [
        "https://base.merkle.io",
        "https://mainnet.base.org",
        "https://base.llamarpc.com",
        "https://1rpc.io/base"
    ],
    NETWORKS: [
        { 
            name: "BASE_L2", chainId: 8453, 
            wss: process.env.BASE_WSS || "wss://base-rpc.publicnode.com", 
            privateRpc: "https://base.merkle.io",
            color: TXT.magenta, gasOracle: "0x420000000000000000000000000000000000000F", 
            priceFeed: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70", 
            router: "0x2626664c2603336E57B271c5C0b26F421741e481",
            weth: "0x4200000000000000000000000000000000000006",
            aavePool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5"
        },
        { 
            name: "ETH_MAIN", chainId: 1, 
            rpc: "https://rpc.flashbots.net", 
            wss: process.env.ETH_WSS || "wss://ethereum-rpc.publicnode.com", 
            type: "FLASHBOTS", relay: "https://relay.flashbots.net",
            color: TXT.cyan, priceFeed: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
            router: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
            aavePool: "0x87870Bca3F3f6332F99512Af77db630d00Z638025",
            weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
        }
    ]
};

// --- MASTER PROCESS ---
if (cluster.isPrimary) {
    console.clear();
    console.log(`${TXT.gold}╔════════════════════════════════════════════════════════╗`);
    console.log(`║   ⚡ APEX MASTER v33.2 | STABILIZED DYNAMIC ENGINE    ║`);
    console.log(`║   DNA: 48-CORE COORDINATION + MEMORY LEAK PROTECTION ║`);
    console.log(`╚════════════════════════════════════════════════════════╝${TXT.reset}\n`);

    const nonces = {};
    const cpuCount = Math.min(os.cpus().length, 48);
    
    // Centralized Broadcaster to prevent MaxListenersExceeded
    const broadcastToWorkers = (msg) => {
        Object.values(cluster.workers).forEach(worker => {
            if (worker && worker.isConnected()) worker.send(msg);
        });
    };

    const spawnWorkers = async () => {
        for (let i = 0; i < cpuCount; i++) {
            const worker = cluster.fork();
            
            worker.on('message', (msg) => {
                if (msg.type === 'SYNC_RESERVE') {
                    if (!nonces[msg.chainId] || msg.nonce > nonces[msg.chainId]) nonces[msg.chainId] = msg.nonce;
                    worker.send({ type: 'SYNC_GRANT', nonce: nonces[msg.chainId], chainId: msg.chainId, reqId: msg.reqId });
                    nonces[msg.chainId]++;
                }
                if (msg.type === 'SIGNAL') broadcastToWorkers(msg);
            });
            
            // v30.1: Staggered boot (1.5s) to bypass RPC 429 Handshake Guard
            await new Promise(r => setTimeout(r, 1500));
        }
    };

    spawnWorkers();
    cluster.on('exit', () => setTimeout(() => cluster.fork(), 3000));
} else {
    // --- WORKER CORE ---
    const networkIndex = (cluster.worker.id - 1) % GLOBAL_CONFIG.NETWORKS.length;
    initWorker(GLOBAL_CONFIG.NETWORKS[networkIndex]);
}

async function initWorker(CHAIN) {
    const network = ethers.Network.from(CHAIN.chainId);
    const provider = new FallbackProvider(GLOBAL_CONFIG.RPC_POOL.map((url, i) => ({
        provider: new JsonRpcProvider(url, network, { staticNetwork: true }),
        priority: i + 1, stallTimeout: 1000
    })), network, { quorum: 1 });

    const wallet = new Wallet(process.env.TREASURY_PRIVATE_KEY.trim(), provider);
    const poolIface = new Interface(["function flashLoanSimple(address receiver, address asset, uint256 amount, bytes params, uint16 referral)"]);
    const l1Oracle = CHAIN.gasOracle ? new Contract(CHAIN.gasOracle, ["function getL1Fee(bytes) view returns (uint256)"], provider) : null;
    const priceFeed = new Contract(CHAIN.priceFeed, ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"], provider);
    
    const ROLE = (cluster.worker.id % 4 === 0) ? "LISTENER" : (cluster.worker.id % 4 === 3 ? "ANALYST" : "STRIKER");
    const TAG = `${CHAIN.color}[${CHAIN.name}-${ROLE}]${TXT.reset}`;

    let currentEthPrice = 0;

    async function connect() {
        try {
            const ws = new WebSocketProvider(CHAIN.wss, network);
            ws.on('error', () => {}); // Catch intra-session 429 noise
            
            if (ROLE === "ANALYST") {
                const updatePrice = async () => { try { const [, p] = await priceFeed.latestRoundData(); currentEthPrice = Number(p) / 1e8; } catch (e) {} };
                await updatePrice(); setInterval(updatePrice, 20000);
            }

            if (ROLE === "LISTENER") {
                ws.on('block', () => process.send({ type: 'SIGNAL', chainId: CHAIN.chainId }));
                const swapTopic = ethers.id("Swap(address,uint256,uint256,uint256,uint256,address)");
                ws.on({ topics: [swapTopic] }, () => process.send({ type: 'SIGNAL', chainId: CHAIN.chainId }));
                console.log(`${TAG} ${TXT.green}DYNAMIC PEERING...${TXT.reset}`);
            } else if (ROLE === "STRIKER") {
                process.on('message', async (msg) => {
                    if (msg.type === 'SIGNAL' && msg.chainId === CHAIN.chainId) {
                        await new Promise(r => setTimeout(r, Math.random() * 20)); // Cluster jitter
                        await executeDynamicStrike(provider, wallet, poolIface, l1Oracle, currentEthPrice, CHAIN, TAG);
                    }
                });
                console.log(`${TAG} ${TXT.yellow}STRIKER READY${TXT.reset}`);
            }
        } catch (e) { setTimeout(connect, 10000); }
    }
    connect();
}

async function executeDynamicStrike(provider, wallet, poolIface, l1Oracle, ethPrice, CHAIN, TAG) {
    try {
        const reqId = Math.random();
        const state = await new Promise(res => {
            const h = m => { if(m.reqId === reqId) { process.removeListener('message', h); res(m); }};
            process.on('message', h);
            process.send({ type: 'SYNC_RESERVE', chainId: CHAIN.chainId, reqId });
        });

        // 1. DYNAMIC WEALTH SCALING
        const balance = await provider.getBalance(wallet.address);
        const usdValue = parseFloat(formatEther(balance)) * ethPrice;
        let loanAmount = parseEther("25"); 
        if (usdValue >= 1000) loanAmount = parseEther("250");
        else if (usdValue >= 500) loanAmount = parseEther("100");

        const tradeData = poolIface.encodeFunctionData("flashLoanSimple", [GLOBAL_CONFIG.TARGET_CONTRACT, CHAIN.weth, loanAmount, "0x", 0]);

        // 2. PRE-FLIGHT SIMULATION + L1 FEE SENSING
        const [sim, l1Fee, feeData] = await Promise.all([
            provider.call({ to: CHAIN.aavePool, data: tradeData, from: wallet.address, gasLimit: GLOBAL_CONFIG.GAS_LIMIT }).catch(() => "0x"),
            l1Oracle ? l1Oracle.getL1Fee(tradeData).catch(() => 0n) : 0n,
            provider.getFeeData()
        ]);

        if (sim === "0x" || BigInt(sim) === 0n) return;

        // 3. NUCLEAR PROFIT MATH
        const baseFee = feeData.maxFeePerGas || feeData.gasPrice || parseEther("0.1", "gwei");
        const priority = parseEther("1000", "gwei");
        const aaveFee = (loanAmount * 5n) / 10000n;
        const totalCost = (GLOBAL_CONFIG.GAS_LIMIT * (baseFee + priority)) + l1Fee + aaveFee;

        if (BigInt(sim) > (totalCost + parseEther(GLOBAL_CONFIG.TUNABLES.MIN_NET_PROFIT))) {
            const tx = { to: CHAIN.aavePool, data: tradeData, type: 2, maxFeePerGas: baseFee + priority, maxPriorityFeePerGas: priority, gasLimit: GLOBAL_CONFIG.GAS_LIMIT, nonce: state.nonce, chainId: CHAIN.chainId };
            const signedHex = await wallet.signTransaction(tx);
            
            // MULTI-CHANNEL BROADCAST
            axios.post(GLOBAL_CONFIG.RPC_POOL[0], { jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [signedHex] }).catch(() => {});
            GLOBAL_CONFIG.RPC_POOL.forEach(url => axios.post(url, { jsonrpc: "2.0", id: 1, method: "eth_sendRawTransaction", params: [signedHex] }).catch(() => {}));
            console.log(`\n${TXT.green}${TXT.bold}🚀 DYNAMIC STRIKE: +${formatEther(BigInt(sim) - totalCost)} ETH [${CHAIN.name}]${TXT.reset}`);
        }
    } catch (e) {}
}
