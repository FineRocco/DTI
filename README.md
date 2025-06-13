# Decentralized Finance DApp

## Team Members (Group 3)
- Henrique Alípio – 64452  
- Denis Ungureanu – 56307  
- Pedro Marques – 64857  

---

## Overview
This project implements a decentralized finance (DeFi) DApp on the Sepolia testnet. It allows users to:
1. Swap between ETH and a custom ERC-20 token (DEX).  
2. Use DEX tokens or NFTs as collateral to borrow ETH.  

The repository includes:
- Solidity smart contracts (ERC-20 “DEX” token, loan logic, NFT-loan logic)  
- A simple HTML/JavaScript front-end that interacts with MetaMask and the deployed contracts (addresses and ABIs already configured in `main.js` and `abi.js`).

---

## Prerequisites
- **Python 3** (to run a local HTTP server)  
- **MetaMask** (browser extension) configured to Sepolia testnet  
- **Chrome** (recommended) or another modern browser  

---

## Running the Project Locally

1. **Ensure `main.js` and `abi.js` Are Preconfigured**  
   - The smart contracts have already been deployed to Sepolia.  
   - `main.js` and `abi.js` contain the correct contract addresses and ABIs—no additional deployment step is required.

2. **Start a Local HTTP Server**  
   > Web3 providers like MetaMask require applications to be served over HTTP or HTTPS.  
   >  
   > **Windows / Linux:** Open a command prompt or terminal, navigate to the project’s root folder, and run:
   ```bash
   python -m http.server 8080
   ```
   - This will serve the front-end at `http://localhost:8080/`.

3. **Connect MetaMask & Navigate to the App**  
   - Open Chrome (or another modern browser) and ensure MetaMask is unlocked and set to the Sepolia network.  
   - In the address bar, go to:
     ```
     http://localhost:8080/
     ```
   - Click the **Connect** button on the page to authorize MetaMask. (Whenever you refresh, you must click **Connect** again.)

4. **Minting & Image Uploads (Optional)**  
   - If you want your minted tokens (ERC-20 or NFTs) to display images, use image URLs from Wikimedia Commons (e.g. `https://commons.wikimedia.org/wiki/Main_Page`) and update the metadata JSON accordingly.

---

## Important Notes
- **Loan IDs & NFT IDs start at 1**.  
- **MetaMask Connection**: Whenever the page reloads, click **Connect** to re-authorize.  
- **Smart Contracts**: The interface is already configured with deployed contracts for testing. Refer to the **DeFi Smart Contract Parameters** section below for the correct units and value types.
- **Use an HTTP Server**: Browsing via `file://` will NOT work with MetaMask. Always serve over `http://localhost:8080/`.


---

### Smart Contract Parameters (Used)
- **Swap Rate:** 10 (wei per DEX token)
- **Periodicity:** 172800 seconds
- **Interest Rate:** 10%
- **Termination Fee:** 10%
