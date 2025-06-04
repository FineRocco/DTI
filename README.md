# Project: Decentralized Finance Application

## Team Members

* Henrique Alípio - 64452
* Denis Ungureanu - 56307
* Pedro Marques - 64857

## Overview
This project implements a decentralized finance (DeFi) DApp on the Sepolia testnet. It allows users to:
1. Swap between ETH and a custom ERC-20 token (DEX).  
2. Use DEX tokens or NFTs as collateral to borrow ETH (up to 50% LTV).  

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

3. **Connect MetaMask & Navigate to the DApp**  
   - Open Chrome (or another modern browser) and ensure MetaMask is unlocked and set to the Sepolia network.  
   - In the address bar, go to:
     ```
     http://localhost:8080/
     ```
   - Click the **Connect** button on the page to authorize MetaMask. (Whenever you refresh, you must click **Connect** again.)

4. **Minting & Image Uploads (Optional)**  
   - If you want your minted tokens (ERC-20 or NFTs) to display images, use image URLs from Wikimedia Commons (e.g. `https://commons.wikimedia.org/wiki/Main_Page`) and update the metadata JSON accordingly.

---

## Usage Instructions

### 1. Swapping ETH ⇄ DEX
- **Buy DEX**: Enter an ETH amount, click **Buy DEX**.  
- **Sell DEX**: Enter a DEX token amount, click **Sell DEX**.  

### 2. DEX-Collateralized Loans
- **Request a DEX Loan**:  
  1. Enter the number of DEX tokens to stake.  
  2. Enter a deadline (timestamp must be ≤ 30 days from now).  
  3. Click **Borrow ETH**.  
- **Make Payments**:  
  - Each `periodicity` interval (e.g. 3 minutes for testing), click **Make Payment** next to your active loan.  
  - On the final payment, you must pay interest + principal to receive your DEX back.  
- **Terminate Early**:  
  - Enter the loan ID and click **Terminate Loan**. You must send exactly (principal + termination fee) in ETH.  

### 3. NFT-Collateralized Loans
- **Approve NFT**:  
  - In MetaMask, call `approve(contractAddress, tokenId)` or `setApprovalForAll(contractAddress, true)` on the NFT contract.  
- **Request an NFT Loan**:  
  1. Enter the NFT contract address.  
  2. Enter your token ID (starting at 1).  
  3. Enter the desired loan amount (in wei).  
  4. Enter a deadline (≤ 30 days from now).  
  5. Click **Request NFT Loan**.  
- **Fund an NFT Loan**:  
  - Under **Available NFT Loans**, click **Fund** for a listed request. Enter the required ETH (50% LTV) and your DEX stake.  
  - Once funded, the ETH is sent to the borrower, and the NFT remains in escrow until the borrower repays.  
- **Repay an NFT Loan**:  
  - Each `periodicity` cycle, click **Make Payment** next to your active NFT loan. Interest is paid to the lender.  
  - On the final payment, pay interest + principal in ETH; your NFT will be returned to your wallet, and the lender’s staked DEX returns to them.  
- **Cancel NFT Request** (before funding):  
  - Click **Cancel** next to your pending request. The NFT was never transferred, so it remains in your wallet.

### 4. Admin Panel
- Only the contract owner sees this section.  
- **Update Swap Rate**: Enter a new DEX ⇄ ETH rate (wei per DEX) and click **Update**.  
- **Check Loans**: Click **Check All Loans** to invoke `checkLoan(loanId)` for every active loan (enforces defaults).

---

## Important Notes
- **Loan IDs & NFT IDs start at 1**.  
- **MetaMask Connection**: Whenever the page reloads, click **Connect** to re-authorize.  
- **Use an HTTP Server**: Browsing via `file://` will NOT work with MetaMask. Always serve over `http://localhost:8080/`.
- **Sepolia Test Network:** This project is intended to be run on the Sepolia test network.
- **Acquire Test ETH:** It is crucial to acquire Sepolia ETH from faucets as soon as possible to test the project. Suggested faucets include:
    * `https://cloud.google.com/application/web3/faucet/ethereum/sepolia`
    * `https://faucets.chain.link/sepolia`

---
