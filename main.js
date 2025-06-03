// Global declarations should use 'let' if they will be reassigned
let web3;
let userAccount;
let defi_contract;
let nft_contract;

// --- Contract Setup --- (These can remain const as they are not reassigned)
const defi_contractAddress = "0x8dbEf4e4d170447e2F3dC881Caed895CfcA883b7";
import { defi_abi } from "./abi_decentralized_finance.js";

const nft_contractAddress = "0xfa6F3ee2e7f99576f356810f37A394cD34691e38";
import { nft_abi } from "./abi_nft.js";

async function connectMetaMask() {
    if (window.ethereum) {
        try {
            // Initialize web3 INSIDE connectMetaMask
            web3 = new Web3(window.ethereum);

            const accounts = await window.ethereum.request({
                method: "eth_requestAccounts",
            });
            
            userAccount = accounts[0]; // Assign global userAccount
            console.log("Connected account:", userAccount);
            document.getElementById("walletAddress").innerText = "Wallet: " + userAccount;

            // Initialize contract instances INSIDE connectMetaMask, AFTER web3 is set
            if (defi_abi && defi_contractAddress) {
                defi_contract = new web3.eth.Contract(defi_abi, defi_contractAddress);
                console.log("DeFi contract instance created.");
            } else {
                console.error("DeFi ABI or Address missing for contract initialization.");
                alert("Failed to initialize DeFi contract. ABI/Address missing.");
                return; // Prevent further execution if main contract fails
            }

            if (nft_abi && nft_contractAddress) {
                nft_contract = new web3.eth.Contract(nft_abi, nft_contractAddress);
                console.log("NFT contract instance created.");
            } else {
                console.error("NFT ABI or Address missing for contract initialization.");
                // Potentially alert or just log, depending on how critical NFT contract is initially
            }

            alert("Wallet connected successfully and contracts initialized!");
            
            // Perform initial UI updates and checks
            await checkAndDisplayOwnerFunctions();
            await getRateEthToDex();
            await getEthTotalBalance();
            await getDex();
            // Ensure displayNftMintPrice is called after nft_contract is initialized
            if (typeof window.displayNftMintPrice === 'function') { // Check if it's defined
                await window.displayNftMintPrice();
            } else {
                console.warn("displayNftMintPrice function not found on window object.");
            }

        } catch (error) {
            console.error("Error connecting to MetaMask or initializing contracts:", error);
            alert("Error connecting: " + (error.message || "Unknown error"));
        }
    } else {
        console.error("MetaMask not found. Please install the MetaMask extension.");
        alert("MetaMask not found. Please install the MetaMask extension.");
    }
}

async function checkAndDisplayOwnerFunctions() {
    try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        const userAddress = accounts[0];

        const ownerAddress = await defi_contract.methods.owner().call();

        if (userAddress.toLowerCase() === ownerAddress.toLowerCase()) {
            document.getElementById("ownerSection").style.display = "block";
            console.log("Current user is the owner.");

            listenToLoanCreation();
            // Start periodic check
            setInterval(checkLoanStatus, 10 * 60 * 1000); // Every 10 minutes

        } else {
            console.log("Current user is not the owner.");
        }
    } catch (error) {
        console.error("Error checking contract owner:", error);
    }
}
async function getRateEthToDex() { // See exchange rate [cite: 62]
    if (!defi_contract) return alert("Connect wallet and initialize contract first.");
    try {
        const rateWeiPerDEX = await defi_contract.methods.dexSwapRate().call(); // This is Wei for 1 whole DEX
        // To display "X DEX per 1 ETH":
        // 1 ETH = 10^18 Wei.
        // DEX per ETH = (10^18 Wei / rateWeiPerDEX) * (1 / 10^decimals_of_DEX_if_rateWeiPerDEX_is_for_smallest_unit)
        // If rateWeiPerDEX is Wei for 1 WHOLE DEX (10^18 smallest units if DEX has 18 decimals):
        // DEX per ETH = (10^18 Wei) / rateWeiPerDEX (this gives number of WHOLE DEX tokens)
        const oneEthInWei = web3.utils.toBN(web3.utils.toWei('1', 'ether'));
        const dexPerEth = oneEthInWei.mul(web3.utils.toBN(10).pow(web3.utils.toBN(18))).div(web3.utils.toBN(rateWeiPerDEX)).div(web3.utils.toBN(10).pow(web3.utils.toBN(18))); // Result in whole DEX units


        console.log("dexToWeiSwapRate (Wei per 1 whole DEX):", rateWeiPerDEX.toString());
        console.log("Calculated DEX per 1 ETH:", dexPerEth.toString());
        // Update UI
        const exchangeRateDisp = document.getElementById('exchangeRateDisplay'); // Assumed ID
        if(exchangeRateDisp) exchangeRateDisp.textContent = `1 ETH = ${dexPerEth.toString()} DEX (Raw rate: ${rateWeiPerDEX} Wei/DEX)`;
        return { weiPerDEX: rateWeiPerDEX.toString(), dexPerEth: dexPerEth.toString() };
    } catch (error) {
        console.error("Error fetching exchange rate:", error);
        alert("Error fetching exchange rate: " + error.message);
    }
}
async function getEthTotalBalance() { // See contract's ETH balance [cite: 62]
    if (!web3 || !defi_contractAddress) return alert("Web3 not initialized or contract address missing.");
    try {
        const balanceWei = await web3.eth.getBalance(defi_contractAddress);
        const balanceEth = web3.utils.fromWei(balanceWei, 'ether');
        console.log("Contract ETH Balance:", balanceEth);
        // Update UI
        const contractEthDisp = document.getElementById('contractEthBalanceDisplay'); // Assumed ID
        if(contractEthDisp) contractEthDisp.textContent = `${balanceEth} ETH`;
        return balanceEth;
    } catch (error) {
        console.error("Error fetching contract ETH balance:", error);
        alert("Error fetching contract ETH balance: " + error.message);
    }
}

async function setRateEthToDex() {
    const newRate = document.getElementById("newExchangeRate").value;
    const accounts = await web3.eth.getAccounts();
    await defi_contract.methods.ownerSetDexSwapRate(newRate).send({ from: accounts[0] });
}

async function listenToLoanCreation() {
    defi_contract.events.loanCreated()
        .on("data", (event) => {
            const { borrower, amount, deadline } = event.returnValues;
            console.log(`New loan: ${borrower}, valuw: ${web3.utils.fromWei(amount)} ETH, deadline: ${new Date(deadline * 1000)}`);
        })
        .on("error", console.error);
}

async function checkLoanStatus() {
    const accounts = await web3.eth.getAccounts();
    const totalLoans = await defi_contract.methods.loanCounter().call();

    for (let i = 0; i < totalLoans; i++) {
        try {
            await defi_contract.methods.checkLoan(i).send({ from: accounts[0] });
        } catch (err) {
            console.warn(`Error checking loan ${i}:`, err.message);
        }
    }
}

async function buyDex() {
    const accounts = await web3.eth.getAccounts();
    const amountInWei = document.getElementById("buyDexAmountWei").value;
    await defi_contract.methods.buyDex().send({
        from: accounts[0],
        value: amountInWei
    });
}

async function getDex() {
    const accounts = await web3.eth.getAccounts();
    const balance = await defi_contract.methods.getDexBalance().call({ from: accounts[0] });
    document.getElementById('myDexBalanceDisplay').textContent = `${balance}`;
    console.log(`Balance: ${balance}`);

    
}

async function sellDex() {
    const accounts = await web3.eth.getAccounts();
    const amountInWei = document.getElementById("sellDexAmountDex").value;
    await defi_contract.methods.sellDex(amountInWei).send({ from: accounts[0] });
}

async function loan() {
    const accounts = await web3.eth.getAccounts();
    const amountInDex = document.getElementById("loanDexAmount").value;
    const deadline = document.getElementById("loanDexDeadline").value;
    //const deadlineTimestamp = Math.floor(Date.now() / 1000) + deadline * 24 * 60 * 60; // 3 dias, por exemplo
    await defi_contract.methods.loan(amountInDex, deadline).send({ from: accounts[0] });
    await getDex();
}

async function terminateLoan() {
    const loanId = document.getElementById("returnLoanId").value;
    const ethAmount = document.getElementById("returnLoanAmountEth").value;
    const accounts = await web3.eth.getAccounts();

    await defi_contract.methods.terminateLoan(loanId).send({
        from: accounts[0],
        value: web3.utils.toWei(ethAmount, "ether")
    });
}

async function getTotalBorrowedAndNotPaidBackEth() {
    const totalLoans = await defi_contract.methods.loanCounter().call();
    let total = web3.utils.toBN("0");

    for (let i = 0; i < totalLoans; i++) {
        const ln = await defi_contract.methods.loans(i).call();
        if (ln.isActive) {
            total = total.add(web3.utils.toBN(ln.amount));
        }
    }
    document.getElementById('myBorrowedEthDisplay').textContent = `${total}`;

}

// For periodic payments:
async function makePeriodicPayment() {
    if (!defi_contract || !userAccount) return alert("Connect wallet first.");
    const loanIdInput = document.getElementById('periodicPaymentLoanId'); // Assumed ID
    const paymentAmountEthInput = document.getElementById('periodicPaymentAmountEth'); // Assumed ID

    if (!loanIdInput || !loanIdInput.value) return alert("Loan ID for payment not found or empty.");
    if (!paymentAmountEthInput || !paymentAmountEthInput.value) return alert("Payment amount for payment not found or empty.");
    
    const loanId = loanIdInput.value;
    const paymentAmountEth = paymentAmountEthInput.value;

    try {
        const paymentWei = web3.utils.toWei(paymentAmountEth, 'ether');
        await defi_contract.methods.makePayment(loanId).send({ from: userAccount, value: paymentWei });
        alert(`Periodic payment for loan ${loanId} successful!`);
        // Update relevant displays
    } catch (error) {
        console.error(`Error making periodic payment for loan ${loanId}:`, error);
        alert(`Error making periodic payment for loan ${loanId}: ` + error.message);
    }
}

async function makeLoanRequestByNft() { // [cite: 62]
    if (!defi_contract || !userAccount) return alert("Connect wallet first.");
    const nftContractAddrInput = document.getElementById('loanNftContractAddress'); // Assumed ID
    const nftTokenIdInput = document.getElementById('loanNftTokenId'); // Assumed ID
    const ethLoanAmountInput = document.getElementById('loanNftEthAmount'); // Assumed ID
    const deadlineInput = document.getElementById('loanNftDeadline'); // Assumed ID, expects days

    if (!nftContractAddrInput || !nftTokenIdInput || !ethLoanAmountInput || !deadlineInput ||
        !nftContractAddrInput.value || !nftTokenIdInput.value || !ethLoanAmountInput.value || !deadlineInput.value) {
        return alert("All NFT loan request fields are required.");
    }

    const nftContractAddr = nftContractAddrInput.value;
    const nftTokenId = nftTokenIdInput.value;
    const ethLoanAmount = ethLoanAmountInput.value;
    const deadlineInDays = parseInt(deadlineInput.value);

    if (!web3.utils.isAddress(nftContractAddr)) return alert("Invalid NFT Contract address.");
    if (isNaN(deadlineInDays) || deadlineInDays <= 0) return alert("Invalid deadline.");

    try {
        const loanAmountWei = web3.utils.toWei(ethLoanAmount, 'ether');
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const deadlineTimestamp = currentTimestamp + (deadlineInDays * 24 * 60 * 60);

        // User must own the NFT. The contract's makeLoanRequestByNft should verify this.
        // User must also approve the DeFi contract to take the NFT IF the loan is funded.
        // This approval might be done separately or just before loanByNft is called by a lender.
        // For `makeLoanRequestByNft`, only the request is created.

        const result = await defi_contract.methods.makeLoanRequestByNft(nftContractAddr, nftTokenId, loanAmountWei, deadlineTimestamp).send({ from: userAccount });
        const loanId = result.events?.LoanRequested?.returnValues?.loanId;
        alert(`NFT loan request submitted successfully! ${loanId ? 'Loan ID: ' + loanId : 'Check transaction.'}`);
        await getAvailableNfts(); // Refresh list
    } catch (error) {
        console.error("Error making NFT loan request:", error);
        alert("Error making NFT loan request: " + error.message);
    }
}

async function cancelLoanRequestByNft() { // [cite: 62]
    if (!defi_contract || !userAccount) return alert("Connect wallet first.");
    const nftContractAddrInput = document.getElementById('cancelNftContractAddress'); // Assumed ID
    const nftTokenIdInput = document.getElementById('cancelNftTokenId'); // Assumed ID

    if (!nftContractAddrInput || !nftTokenIdInput || !nftContractAddrInput.value || !nftTokenIdInput.value) {
        return alert("NFT contract address and Token ID are required to cancel.");
    }
    const nftContractAddr = nftContractAddrInput.value;
    const nftTokenId = nftTokenIdInput.value;

    try {
        // The contract function takes these details to find and cancel the loan.
        await defi_contract.methods.cancelLoanRequestByNft(nftContractAddr, nftTokenId).send({ from: userAccount });
        alert("NFT loan request cancelled successfully!");
        await getAvailableNfts(); // Refresh list
    } catch (error) {
        console.error("Error cancelling NFT loan request:", error);
        alert("Error cancelling NFT loan request: " + error.message);
    }
}

async function loanByNft() { // Lender funds an NFT loan request [cite: 62]
    if (!defi_contract || !userAccount) return alert("Connect wallet first.");
    // This function would typically be triggered by clicking a "fund" button next to an available NFT loan request.
    // The button would pass the nftContractAddr, nftTokenId, and the required ETH amount.
    const nftContractAddr = prompt("Enter NFT Contract Address of the loan to fund:"); // Placeholder for UI
    const nftTokenId = prompt("Enter NFT Token ID of the loan to fund:"); // Placeholder for UI
    const lenderDexStakeAmount = prompt("Enter amount of YOUR DEX to stake (smallest units):"); // Placeholder for UI

    if (!nftContractAddr || !nftTokenId || !lenderDexStakeAmount) return alert("All details required to fund NFT loan.");
    if (!web3.utils.isAddress(nftContractAddr)) return alert("Invalid NFT Contract address.");


    try {
        // The lender needs to know how much ETH to send. This would be part of the displayed loan request.
        // Let's assume we fetch the loan details first to get the principalAmount.
        const loanId = await defi_contract.methods.nftLoanRequestLoanId(nftContractAddr, nftTokenId).call();
        if (loanId === "0" || !loanId) return alert("No active loan request found for this NFT.");

        const loanDetails = await defi_contract.methods.getLoanDetails(loanId).call();
        if (!loanDetails.active || loanDetails.funded) return alert("Loan is not available for funding.");

        const ethToSendWei = loanDetails.principalAmount;
        const dexStakeSmallestUnits = lenderDexStakeAmount; // Already in smallest units from prompt

        // Lender B must approve the DeFi contract to spend their DEX tokens for staking
        // Assuming 'defi_contract' is also the ERC20 contract for DEX, no separate instance needed.
        // If DEX token is a *separate* contract:
        // const dexToken = new web3.eth.Contract(dexTokenAbi, dexTokenAddress);
        // await dexToken.methods.approve(defi_contractAddress, dexStakeSmallestUnits).send({from: userAccount});
        // alert("DEX approved for staking by lender. Now confirming loan funding...");
        // If DeFi contract IS the DEX token, internal _transfer will be used.

        await defi_contract.methods.loanByNft(nftContractAddr, nftTokenId, dexStakeSmallestUnits).send({ from: userAccount, value: ethToSendWei });
        alert(`Successfully funded NFT loan for NFT ID ${nftTokenId}!`);
        await getAvailableNfts(); // Refresh list
        await getEthTotalBalance();
    } catch (error) {
        console.error("Error funding NFT loan:", error);
        alert("Error funding NFT loan: " + error.message);
    }
}

async function getAvailableNfts() { // See available NFTs to lend ETH to [cite: 62]
    if (!defi_contract) return alert("Connect wallet first.");
    alert("Fetching available NFT loan requests. This requires specific contract logic (e.g., iterating IDs or querying events). Implementing placeholder.");
    // This is complex. The contract needs a way to list pending NFT loan requests.
    // E.g., a public array of `activeNftLoanRequestIds` or querying past `LoanRequested` events where lender is address(0).
    // For now, a placeholder:
    const availableNftListEl = document.getElementById('availableNftLoanRequests'); // Assumed ID
    if (availableNftListEl) availableNftListEl.innerHTML = '<li>Fetching available NFT loans... (Requires contract support for listing)</li>';

    console.log("Placeholder for getAvailableNfts. Contract needs a way to list pending requests.");
}

async function getAllTokenURIs() {
    if (!nft_contract || !userAccount) {
        alert("Connect wallet and ensure NFT contract is initialized.");
        return [];
    }
    try {
        const balanceString = await nft_contract.methods.balanceOf(userAccount).call();
        const balance = parseInt(balanceString);
        console.log(`NFT Balance for ${userAccount}: ${balance}`);

        if (balance === 0) {
            alert("You don't own any NFTs from this collection.");
            document.getElementById('myNftList').innerHTML = '<li>You do not own any NFTs from this collection.</li>';
            return [];
        }

        // Test with only the first token
        console.log("Attempting to get tokenId for index 0...");
        const tokenId = await nft_contract.methods.tokenOfOwnerByIndex(userAccount, 0).call(); // Test this call
        console.log("TokenId at index 0:", tokenId);

        const tokenURI = await nft_contract.methods.tokenURI(tokenId).call();
        console.log(`Token ID: ${tokenId}, URI: ${tokenURI}`);

        // ... (rest of the loop and UI update if the above works) ...
        // For now, just alert the first one
        alert(`First NFT: ID ${tokenId}, URI: ${tokenURI}`);
        document.getElementById('myNftList').innerHTML = `<li>Token ID: ${tokenId}, URI: ${tokenURI}</li>`;


        return [{ tokenId, tokenURI }]; // Return just the first for testing
    } catch (error) {
        console.error("Error fetching token URIs:", error);
        document.getElementById('myNftList').innerHTML = '<li>Error fetching your NFTs.</li>';
        alert("Error fetching token URIs: " + (error.message || "Execution reverted. Check console."));
        return [];
    }
}

// Function to display NFT Mint Price
async function displayNftMintPrice() {
    if (!nft_contract) {
        // Attempt to initialize if not already (e.g. if page was refreshed and wallet was auto-connected)
        if (web3 && nft_contractAddress && nft_abi) {
             try {
                nft_contract = new web3.eth.Contract(nft_abi, nft_contractAddress);
             } catch (e) {
                console.error("Failed to initialize nft_contract in displayNftMintPrice:", e);
                const mintPriceDisplayEl = document.getElementById('nftMintPriceDisplay');
                if (mintPriceDisplayEl) mintPriceDisplayEl.textContent = "Error initializing contract";
                return;
             }
        } else {
            console.log("NFT Contract not ready for fetching mint price (web3, address, or ABI missing).");
            const mintPriceDisplayEl = document.getElementById('nftMintPriceDisplay');
            if (mintPriceDisplayEl) mintPriceDisplayEl.textContent = "Contract N/A";
            return;
        }
    }

    try {
        const priceInWei = await nft_contract.methods.mintPrice().call();
        const mintPriceDisplayEl = document.getElementById('nftMintPriceDisplay');
        if (mintPriceDisplayEl) {
            // Displaying in Wei as the contract stores it in Wei.
            // You could convert to Ether for display if preferred: web3.utils.fromWei(priceInWei, 'ether') + " ETH"
            mintPriceDisplayEl.textContent = `${priceInWei.toString()} Wei`;
        }
    } catch (error) {
        console.error("Error fetching NFT mint price:", error);
        const mintPriceDisplayEl = document.getElementById('nftMintPriceDisplay');
        if (mintPriceDisplayEl) {
            mintPriceDisplayEl.textContent = "Error loading price";
        }
    }
}

// Function to mint a new NFT
async function mintNewNFT() {
    if (!nft_contract || !userAccount) {
        alert("Please connect your wallet first and ensure the NFT contract is initialized.");
        return;
    }

    const tokenURIInput = document.getElementById('nftTokenURIInput');
    if (!tokenURIInput || !tokenURIInput.value.trim()) {
        alert("Please enter a Token URI for your NFT (e.g., an IPFS link to your metadata JSON).");
        return;
    }
    const tokenURI = tokenURIInput.value.trim();

    try {
        const currentMintPriceWei = await nft_contract.methods.mintPrice().call();
        console.log(`Attempting to mint NFT with URI: "${tokenURI}" for ${currentMintPriceWei} Wei`);

        // Send the transaction to the mint function of your SimpleNFT contract
        await nft_contract.methods.mint(tokenURI).send({ from: userAccount, value: currentMintPriceWei });

        alert("NFT minted successfully! Transaction confirmed. It may take a moment to appear in your wallet or on marketplaces.");
        tokenURIInput.value = ""; // Clear the input field after successful mint

        // Optionally, refresh the list of owned NFTs if you have such a function
        if (typeof window.getAllTokenURIs === 'function') {
            await window.getAllTokenURIs();
        }
    } catch (error) {
        console.error("Error minting NFT:", error);
        // Try to provide a more user-friendly error message
        let errorMessage = "Error minting NFT. ";
        if (error.message) {
            if (error.message.includes("User denied transaction signature")) {
                errorMessage += "You rejected the transaction in MetaMask.";
            } else if (error.message.includes("Incorrect ETH value sent")) { // Matches require string in SimpleNFT
                errorMessage += "Incorrect ETH value sent. Please check the mint price.";
            } else {
                errorMessage += error.message;
            }
        } else if (error.code === 4001) { // MetaMask user denied transaction
             errorMessage += "You rejected the transaction in MetaMask.";
        } else {
            errorMessage += "An unknown error occurred. Check the console for details.";
        }
        alert(errorMessage);
    }
}

// --- Assign functions to window object for access from HTML ---
// General
window.connectMetaMask = connectMetaMask;

// User DEX Actions
window.buyDex = buyDex;
window.getDex = getDex; // Gets user's DEX balance
window.sellDex = sellDex;

// User Loan Actions
window.loan = loan; // Request DEX-backed loan
window.makePeriodicPayment = makePeriodicPayment; // User makes periodic payment
window.terminateLoan = terminateLoan; // User terminates/repays loan fully (maps to terminateLoan)
window.makeLoanRequestByNft = makeLoanRequestByNft;
window.cancelLoanRequestByNft = cancelLoanRequestByNft;
window.loanByNft = loanByNft; // User (lender) funds an NFT loan

// User View Functions
window.getEthTotalBalance = getEthTotalBalance; // Contract's ETH balance
window.getRateEthToDex = getRateEthToDex;       // Current swap rate
window.getAvailableNfts = getAvailableNfts;     // List of NFT loan requests to fund
window.getTotalBorrowedAndNotPaidBackEth = getTotalBorrowedAndNotPaidBackEth; // User's outstanding borrowed amount

// Owner Functions
window.setRateEthToDex = setRateEthToDex;       // Owner sets swap rate
window.checkLoanStatus = checkLoanStatus;       // Owner triggers checkLoan on a specific loan
// listenToLoanCreation is called on init for owner

// NFT utilities (if needed)
window.getAllTokenURIs = getAllTokenURIs;
window.mintNewNFT = mintNewNFT;
window.displayNftMintPrice = displayNftMintPrice;

// Initial connection attempt or setup when script loads
window.addEventListener('load', () => {
    // It's often better to have the user click a "Connect Wallet" button
    // connectMetaMask();
    console.log("DApp loaded. Click 'Connect Wallet'.");
});

// Handle account or network changes from MetaMask
if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
        console.log('Accounts changed:', accounts);
        if (accounts.length > 0) {
            userAccount = accounts[0];
            // Re-initialize DApp state for the new account
            alert("Account changed. Re-initializing...");
            connectMetaMask(); // Re-connect and update UI
        } else {
            userAccount = null;
            defi_contract = null;
            nft_contract = null;
            alert("Wallet disconnected.");
            document.getElementById('walletAddress').textContent = 'Wallet: Not Connected';
            const ownerSec = document.getElementById('ownerSection');
            if(ownerSec) ownerSec.style.display = 'none';
        }
    });

    window.ethereum.on('chainChanged', (chainId) => {
        console.log('Network changed to:', chainId);
        alert("Network changed. Please ensure you are on the correct network (e.g., Sepolia) and reload the page.");
        window.location.reload();
    });
}