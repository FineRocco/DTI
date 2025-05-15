# Project: Decentralized Finance Application

## Team Members

* Henrique Alípio - 64452
* Denis Ungureanu - 56307
* Pedro Marques - 64857

## Project Description

This project involves the construction of a decentralized finance (DeFi) application on the Ethereum blockchain. The core functionality includes:

* **Token Swapping:** Facilitating the exchange between ETH and a custom DEX (fungible) token. [cite_start] Users can buy and sell DEX tokens. [cite: 1, 2]
* [cite_start] **Collateralized Loans:** Allowing users to leverage their DEX token holdings and NFTs as collateral to borrow ETH. [cite: 2] [cite_start] Specifically, they can borrow up to 50% of the value of their DEX holding or NFT tokens in ETH. [cite: 3] [cite_start] Once the loan is repaid, users can retain ownership of the DEX or NFT tokens presented as collateral. [cite: 4]

[cite_start] The application aims to adjust the DEX-ETH swap rate dynamically based on the contract's DEX and ETH reserves, reacting to buy/sell orders and loan activities. [cite: 57]

## Components

[cite_start] The project is structured into three main parts: [cite: 7]

1.  [cite_start] **Smart Contract:** This is the server-side logic of the application, built as an ERC20 token standard for the custom DEX token. [cite: 1, 10, 13] It manages token functionalities, loan mechanisms (including interest, deadlines, and collateral management), and swap rates.
2.  [cite_start] **JavaScript File:** This handles the client-side logic of the application. [cite: 8]
3.  [cite_start] **HTML File:** This defines the application's layout and user interface. [cite: 8]

## How to Run

To run the project, ensure you have the necessary environment set up for Ethereum development (e.g., Node.js, npm, Truffle/Hardhat, a web browser with a wallet extension like MetaMask).

1.  **Deploy the Smart Contract:**
    * Compile the smart contract.
    * Deploy the compiled contract to an Ethereum test network (e.g., Sepolia). Note the contract address after deployment.
    * [cite_start] The constructor requires an initial DEX-ETH swap rate. [cite: 31] [cite_start] $10^{18}$ DEX tokens are minted upon deployment. [cite: 31]

2.  **Configure the Client-Side Application:**
    * Update the JavaScript file with the deployed smart contract address and ABI.
    * Ensure the HTML file correctly links to the JavaScript file and any other dependencies.

3.  **Run the Application:**
    * Open the HTML file in a web browser.
    * Connect your Ethereum wallet (e.g., MetaMask) to the application and ensure it's set to the correct test network.

    [cite_start] **Owner functionalities include**: [cite: 58]
    * [cite_start] Setting the exchange rate. [cite: 58]
    * [cite_start] Being informed when a loan is created. [cite: 58]
    * [cite_start] Checking the status of created loans (e.g., every 10 minutes by calling `checkLoan`). [cite: 58]

    [cite_start] **User functionalities include**: [cite: 59]
    * [cite_start] Buying and selling DEX tokens. [cite: 32, 34, 59]
    * [cite_start] Viewing their DEX token balance. [cite: 45, 59]
    * [cite_start] Requesting loans using DEX or NFTs as collateral. [cite: 35, 46, 59]
    * [cite_start] Returning borrowed ETH. [cite: 41, 59]
    * [cite_start] Viewing the contract's total ETH balance and the current exchange rate. [cite: 44, 59]
    * [cite_start] Viewing available NFTs for lending ETH. [cite: 59]
    * [cite_start] Viewing their total borrowed and unpaid ETH. [cite: 59]

## Important Notes

* [cite_start] **Sepolia Test Network:** This project is intended to be run on the Sepolia test network. [cite: 5]
* [cite_start] **Acquire Test ETH:** It is crucial to acquire Sepolia ETH from faucets as soon as possible to test the project. [cite: 5] Suggested faucets include:
    * [cite_start] `https://cloud.google.com/application/web3/faucet/ethereum/sepolia` [cite: 5]
    * [cite_start] `https://faucets.chain.link/sepolia` [cite: 5]
    [cite_start] Each group member should try to collect test ETH daily. [cite: 6]
* [cite_start] **Loan Repayment:** If loan payments are missed, the collateral is lost. [cite: 28] [cite_start] If all periodic payments are met, the final payment must also include the principal loan amount to recover the collateral. [cite: 29] [cite_start] Premature loan termination incurs a fee. [cite: 30, 43]
* [cite_start] **NFT-based Loans:** Users can request loans using NFTs as collateral. [cite: 46] [cite_start] Other users can then lend ETH against these NFTs. [cite: 50] [cite_start] If the borrower defaults, the lender receives the NFT. [cite: 52]
