# Project: Decentralized Finance Application

## Team Members

* Henrique Alípio - 64452
* Denis Ungureanu - 56307
* Pedro Marques - 64857

## Project Description

This project involves the construction of a decentralized finance (DeFi) application on the Ethereum blockchain. The core functionality includes:

* **Token Swapping:** Facilitating the exchange between ETH and a custom DEX (fungible) token. Users can buy and sell DEX tokens.
* **Collateralized Loans:** Allowing users to leverage their DEX token holdings and NFTs as collateral to borrow ETH. Specifically, they can borrow up to 50% of the value of their DEX holding or NFT tokens in ETH. Once the loan is repaid, users can retain ownership of the DEX or NFT tokens presented as collateral.

The application aims to adjust the DEX-ETH swap rate dynamically based on the contract's DEX and ETH reserves, reacting to buy/sell orders and loan activities.

## Components

The project is structured into three main parts:

1.  **Smart Contract:** This is the server-side logic of the application, built as an ERC20 token standard for the custom DEX token. It manages token functionalities, loan mechanisms (including interest, deadlines, and collateral management), and swap rates.
2.  **JavaScript File:** This handles the client-side logic of the application.
3.  **HTML File:** This defines the application's layout and user interface.

## How to Run

To run the project, ensure you have the necessary environment set up for Ethereum development (e.g., Node.js, npm, Truffle/Hardhat, a web browser with a wallet extension like MetaMask).

1.  **Deploy the Smart Contract:**
    * Compile the smart contract.
    * Deploy the compiled contract to an Ethereum test network (e.g., Sepolia). Note the contract address after deployment.
    * The constructor requires an initial DEX-ETH swap rate. $10^{18}$ DEX tokens are minted upon deployment.

2.  **Configure the Client-Side Application:**
    * Update the JavaScript file with the deployed smart contract address and ABI.
    * Ensure the HTML file correctly links to the JavaScript file and any other dependencies.

3.  **Run the Application:**
    * Open the HTML file in a web browser.
    * Connect your Ethereum wallet (e.g., MetaMask) to the application and ensure it's set to the correct test network.

    **Owner functionalities include**:
    * Setting the exchange rate.
    * Being informed when a loan is created.
    * Checking the status of created loans (e.g., every 10 minutes by calling `checkLoan`).

    **User functionalities include**:
    * Buying and selling DEX tokens.
    * Viewing their DEX token balance.
    * Requesting loans using DEX or NFTs as collateral.
    * Returning borrowed ETH.
    * Viewing the contract's total ETH balance and the current exchange rate.
    * Viewing available NFTs for lending ETH.
    * Viewing their total borrowed and unpaid ETH.

## Important Notes

* **Sepolia Test Network:** This project is intended to be run on the Sepolia test network.
* **Acquire Test ETH:** It is crucial to acquire Sepolia ETH from faucets as soon as possible to test the project. Suggested faucets include:
    * `https://cloud.google.com/application/web3/faucet/ethereum/sepolia`
    * `https://faucets.chain.link/sepolia`
    Each group member should try to collect test ETH daily.
* **Loan Repayment:** If loan payments are missed, the collateral is lost. If all periodic payments are met, the final payment must also include the principal loan amount to recover the collateral. Premature loan termination incurs a fee.
* **NFT-based Loans:** Users can request loans using NFTs as collateral. Other users can then lend ETH against these NFTs. If the borrower defaults, the lender receives the NFT.
