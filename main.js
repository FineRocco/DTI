// Ensure Web3.js is loaded, e.g., via a script tag in your HTML:
// <script src="https://cdn.jsdelivr.net/npm/web3@1.10.0/dist/web3.min.js"></script>
// Or if using a bundler: import Web3 from 'web3';

let web3;
let userAccount;
let defi_contract;
let nft_contract;

// --- Contract Setup ---
// Replace with your deployed contract addresses on Sepolia
const defi_contractAddress = "0xE0A3e165c83fB800a68520A124717f2a6bB6bF62";
const nft_contractAddress = "0xAbb121Df663Ec5E9E5FC2c94D1B35397143d38C6";

// Import ABIs (make sure these files exist and export the ABI arrays)
// Example: In abi_decentralized_finance.js -> export const defi_abi = [...];
import { defi_abi } from "./abi_decentralized_finance.js";
import { nft_abi } from "./abi_nft.js";


// --- DOM Element Placeholders (examples, adjust to your HTML) ---
// You'll need to get values from input fields and update display elements.
// const dexAmountInput = document.getElementById('dexAmountInput');
// const ethAmountInput = document.getElementById('ethAmountInput');
// const loanIdInput = document.getElementById('loanIdInput');
// const displayArea = document.getElementById('displayArea');
// const ownerPanel = document.getElementById('ownerPanel'); // For owner-specific UI

// --- Initialization and Wallet Connection ---
async function connectMetaMask() {
    if (window.ethereum) {
        web3 = new Web3(window.ethereum);
        try {
            const accounts = await window.ethereum.request({
                method: "eth_requestAccounts",
            });
            userAccount = accounts[0];
            console.log("Connected account:", userAccount);
            document.getElementById('walletAddress').textContent = `Wallet: ${userAccount.substring(0, 6)}...${userAccount.substring(userAccount.length - 4)}`;


            // Initialize contract instances
            defi_contract = new web3.eth.Contract(defi_abi, defi_contractAddress);
            nft_contract = new web3.eth.Contract(nft_abi, nft_contractAddress);

            alert("Wallet connected successfully!");
            // Perform initial UI updates and checks
            await checkAndDisplayOwnerFunctions();
            await getRateEthToDex(); // Display initial rate
            await getEthTotalBalance(); // Display contract ETH balance
            await getDex(); // Display user's DEX balance
            listenToLoanCreation(); // Start listening for events

        } catch (error) {
            console.error("Error connecting to MetaMask:", error);
            alert("Error connecting to MetaMask: " + error.message);
        }
    } else {
        console.error("MetaMask not found. Please install the MetaMask extension.");
        alert("MetaMask not found. Please install the MetaMask extension.");
    }
}

async function checkAndDisplayOwnerFunctions() {
    if (!defi_contract || !userAccount) return;
    try {
        const owner = await defi_contract.methods.owner().call();
        const ownerSection = document.getElementById('ownerSection'); // Assume this ID for owner panel
        if (owner.toLowerCase() === userAccount.toLowerCase()) {
            if(ownerSection) ownerSection.style.display = 'block';
            console.log("Current user is the owner.");
            // Start periodic check for owner
            setInterval(checkAllRelevantLoans, 10 * 60 * 1000); // Every 10 minutes [cite: 61]
        } else {
            if(ownerSection) ownerSection.style.display = 'none';
            console.log("Current user is not the owner.");
        }
    } catch (error) {
        console.error("Error checking contract owner:", error);
    }
}

// --- Owner Functions ---
async function setRateEthToDex() { // [cite: 61]
    if (!defi_contract || !userAccount) return alert("Connect wallet first.");
    const newRateInput = document.getElementById('newExchangeRate'); // Assumed ID
    if (!newRateInput || !newRateInput.value) return alert("New rate input not found or empty.");

    const newRate = newRateInput.value; // This should be Wei per 1 DEX token, as per contract's dexToWeiSwapRate
    try {
        // Ensure newRate is in the correct format (e.g., Wei for 1 DEX)
        // If UI input is "DEX per ETH", it needs conversion before sending
        // For now, assume input `newRate` is directly `dexToWeiSwapRate` (Wei for 1 DEX)
        await defi_contract.methods.ownerSetDexSwapRate(newRate).send({ from: userAccount });
        alert("Exchange rate set successfully!");
        await getRateEthToDex(); // Update display
    } catch (error) {
        console.error("Error setting exchange rate:", error);
        alert("Error setting exchange rate: " + error.message);
    }
}

async function listenToLoanCreation() { // [cite: 61]
    if (!defi_contract) {
        console.log("DeFi contract not initialized for event listening.");
        return;
    }
    // The PDF event is `loanCreated(address borrower, uint256 amount, uint256 deadline)` [cite: 59]
    // My contract also had a more detailed `LoanRequested` and `LoanFunded`
    defi_contract.events.LoanCreated({ filter: {}, fromBlock: 'latest' })
        .on('data', function(event) {
            console.log("New LoanCreated Event:", event.returnValues);
            // Update UI - e.g., add to a list, show a notification
            const { borrower, amount, deadline } = event.returnValues;
            const loanMsg = `New Loan: Borrower ${borrower}, Amount ${web3.utils.fromWei(amount, 'ether')} ETH, Deadline ${new Date(deadline * 1000).toLocaleString()}`;
            alert(loanMsg); // Simple alert for owner
            // Add to a list in the owner panel
            const loanEventsList = document.getElementById('loanCreatedList'); // Assumed ID
            if (loanEventsList) {
                const listItem = document.createElement('li');
                listItem.textContent = loanMsg;
                loanEventsList.prepend(listItem);
            }
        })
        .on('error', console.error);
    console.log("Listening for LoanCreated events...");
}

async function checkLoanStatus() { // For owner to manually check a specific loan [cite: 61]
    if (!defi_contract || !userAccount) return alert("Connect wallet first.");
    const loanIdInput = document.getElementById('checkLoanId'); // Assumed ID
    if (!loanIdInput || !loanIdInput.value) return alert("Loan ID input not found or empty.");
    const loanId = loanIdInput.value;

    try {
        console.log(`Owner checking status of loan ID: ${loanId}`);
        // `checkLoan` in the contract is an action, not just a status view
        await defi_contract.methods.checkLoan(loanId).send({ from: userAccount });
        alert(`Action to check/process loan ${loanId} sent. Check transaction status and contract state.`);
        // You might want to fetch updated loan details afterwards
        const loanDetails = await defi_contract.methods.getLoanDetails(loanId).call();
        console.log("Updated loan details after check:", loanDetails);
        // Update UI for this specific loan's status display
        const loanStatusDisp = document.getElementById('loanStatusDisplay'); // Assumed ID
        if(loanStatusDisp) loanStatusDisp.textContent = `Loan ${loanId} checked. Active: ${loanDetails.active}, Funded: ${loanDetails.funded}`;

    } catch (error) {
        console.error(`Error checking loan ${loanId}:`, error);
        alert(`Error checking loan ${loanId}: ` + error.message);
    }
}
// For the periodic check by owner [cite: 61]
async function checkAllRelevantLoans() {
    console.log("Owner: Periodically checking relevant loans...");
    // This function needs to know which loans to check.
    // E.g., iterate through a list of active loan IDs fetched from events or another contract method.
    // For now, this is a placeholder for that logic.
    // Example:
    // const activeLoanIds = await getActiveLoanIdsFromContract(); // Needs contract support
    // for (const loanId of activeLoanIds) {
    //     try {
    //         await defi_contract.methods.checkLoan(loanId).send({ from: userAccount });
    //         console.log(`Periodically checked loan ${loanId}`);
    //     } catch (error) {
    //         console.error(`Error periodically checking loan ${loanId}:`, error);
    //     }
    // }
    alert("Owner: Simulated periodic check of loans. Implement logic to get list of active loans.");
}


async function buyDex() { // // Assuming this citation refers to the PDF's client-side requirements for buying DEX
    if (!defi_contract || !userAccount) return alert("Connect wallet first.");
    
    // Assuming your HTML input field for Wei amount has the ID 'buyDexAmountWei'
    const weiAmountInput = document.getElementById('buyDexAmountWei'); // Changed ID
    
    if (!weiAmountInput || !weiAmountInput.value) {
        return alert("Wei amount input not found or empty.");
    }
    
    const weiAmountString = weiAmountInput.value;

    // Validate if the input is a valid non-negative integer string
    if (!/^\d+$/.test(weiAmountString)) {
        return alert("Please enter a valid Wei amount (non-negative integer).");
    }

    try {
        // The input 'weiAmountString' is already in Wei, so no conversion needed
        // It's passed directly as the 'value' property
        await defi_contract.methods.buyDex().send({ from: userAccount, value: weiAmountString });
        alert("DEX purchase successful!");
        
        // Assuming these functions exist and update the UI
        if (typeof getDex === 'function') await getDex(); 
        if (typeof getEthTotalBalance === 'function') await getEthTotalBalance(); 
        
    } catch (error) {
        console.error("Error buying DEX:", error);
        alert("Error buying DEX: " + (error.message || error.data?.message || "Unknown error"));
    }
}

async function getDex() { // See user's DEX balance [cite: 62]
    if (!defi_contract || !userAccount) return alert("Connect wallet first.");
    try {
        // Assuming contract's `getDexBalanceOfUser(address)`
        const balance = await defi_contract.methods.getDexBalanceOfUser(userAccount).call();
        const dexBalanceFormatted = web3.utils.fromWei(balance, 'ether'); // Assuming DEX has 18 decimals
        console.log("User DEX Balance:", dexBalanceFormatted);
        // Update UI
        const myDexBalanceDisp = document.getElementById('myDexBalanceDisplay'); // Assumed ID
        if(myDexBalanceDisp) myDexBalanceDisp.textContent = `${dexBalanceFormatted} DEX`;
        return dexBalanceFormatted;
    } catch (error) {
        console.error("Error fetching DEX balance:", error);
        alert("Error fetching DEX balance: " + error.message);
    }
}

async function sellDex() { // [cite: 62]
    if (!defi_contract || !nft_contract || !userAccount) return alert("Connect wallet first."); // Assuming nft_contract is an alias for dexTokenContract if they are the same for some reason. Correcting to defi_contract for DEX.
    const dexAmountInput = document.getElementById('sellDexAmountDex'); // Assumed ID
    if (!dexAmountInput || !dexAmountInput.value) return alert("DEX amount input not found or empty.");
    const dexAmount = dexAmountInput.value;

    try {
        const dexAmountInSmallestUnits = web3.utils.toWei(dexAmount, 'ether'); // Assuming DEX 18 decimals

        // User must first approve the DeFi contract to spend their DEX tokens
        // The DeFi contract itself is the ERC20 token, so direct transfer within its functions.
        // No separate approval needed IF sellDex handles the token movement from msg.sender using _transfer.
        // If DeFi contract was separate from DEX token, approval would be:
        // const dexTokenContract = new web3.eth.Contract(dexTokenAbi, dexTokenAddress);
        // await dexTokenContract.methods.approve(defi_contractAddress, dexAmountInSmallestUnits).send({ from: userAccount });
        // alert("DEX approved for selling. Now confirming sell transaction...");

        await defi_contract.methods.sellDex(dexAmountInSmallestUnits).send({ from: userAccount });
        alert("DEX sold successfully!");
        await getDex(); // Update user's DEX balance
        await getEthTotalBalance(); // Update contract's ETH balance
    } catch (error) {
        console.error("Error selling DEX:", error);
        alert("Error selling DEX: " + error.message);
    }
}

async function loan() { // Request loan with DEX collateral [cite: 62]
    if (!defi_contract || !userAccount) return alert("Connect wallet first.");
    const dexCollateralInput = document.getElementById('loanDexAmount'); // Assumed ID
    const deadlineInput = document.getElementById('loanDexDeadline'); // Assumed ID, expects days from now

    if (!dexCollateralInput || !dexCollateralInput.value) return alert("DEX collateral input not found or empty.");
    if (!deadlineInput || !deadlineInput.value) return alert("Deadline input not found or empty.");

    const dexCollateralAmount = dexCollateralInput.value;
    const deadlineInDays = parseInt(deadlineInput.value);

    if (isNaN(deadlineInDays) || deadlineInDays <= 0) return alert("Invalid deadline.");

    try {
        const dexAmountInSmallestUnits = web3.utils.toWei(dexCollateralAmount, 'ether'); // DEX 18 decimals

        // Contract `loan` function expects `desiredDeadlineTimestamp`
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const deadlineTimestamp = currentTimestamp + (deadlineInDays * 24 * 60 * 60);

        // DEX approval is handled internally by the contract if it's also the ERC20
        // using _transfer from msg.sender.

        const result = await defi_contract.methods.loan(dexAmountInSmallestUnits, deadlineTimestamp).send({ from: userAccount });
        const loanId = result.events?.LoanRequested?.returnValues?.loanId || result.events?.LoanCreated?.returnValues?.loanId; // Adjust event name if needed
        alert(`DEX-backed loan requested successfully! ${loanId ? 'Loan ID: ' + loanId : 'Check transaction for Loan ID.'}`);
        await getDex();
        await getEthTotalBalance();
    } catch (error) {
        console.error("Error requesting DEX-backed loan:", error);
        alert("Error requesting DEX-backed loan: " + error.message);
    }
}

async function returnLoan() { // This maps to `terminateLoan` for early repayment [cite: 62]
    if (!defi_contract || !userAccount) return alert("Connect wallet first.");
    const loanIdInput = document.getElementById('returnLoanId'); // Assumed ID
    const ethRepaymentInput = document.getElementById('returnLoanAmountEth'); // Assumed ID for repayment amount (principal + fee)

    if (!loanIdInput || !loanIdInput.value) return alert("Loan ID input not found or empty.");
    if (!ethRepaymentInput || !ethRepaymentInput.value) return alert("ETH repayment amount input not found or empty.");

    const loanId = loanIdInput.value;
    const ethToRepay = ethRepaymentInput.value;

    try {
        const weiToSend = web3.utils.toWei(ethToRepay, 'ether');
        await defi_contract.methods.terminateLoan(loanId).send({ from: userAccount, value: weiToSend });
        alert(`Loan ${loanId} termination/repayment successful!`);
        await getDex();
        await getEthTotalBalance();
        // Update user's borrowed amount display
    } catch (error) {
        console.error(`Error returning/terminating loan ${loanId}:`, error);
        alert(`Error returning/terminating loan ${loanId}: ` + error.message);
    }
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

async function getRateEthToDex() { // See exchange rate [cite: 62]
    if (!defi_contract) return alert("Connect wallet and initialize contract first.");
    try {
        const rateWeiPerDEX = await defi_contract.methods.dexToWeiSwapRate().call(); // This is Wei for 1 whole DEX
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

async function getAvailableNfts() { // See available NFTs to lend ETH to [cite: 62]
    if (!defi_contract) return alert("Connect wallet first.");
    alert("Fetching available NFT loan requests. This requires specific contract logic (e.g., iterating IDs or querying events). Implementing placeholder.");
    // This is complex. The contract needs a way to list pending NFT loan requests.
    // E.g., a public array of `activeNftLoanRequestIds` or querying past `LoanRequested` events where lender is address(0).
    // For now, a placeholder:
    const availableNftListEl = document.getElementById('availableNftLoanRequests'); // Assumed ID
    if (availableNftListEl) availableNftListEl.innerHTML = '<li>Fetching available NFT loans... (Requires contract support for listing)</li>';

    // Example if contract had `getPendingNftLoanRequestIds()` and `getLoanDetails(id)`
    /*
    try {
        const requestIds = await defi_contract.methods.getPendingNftLoanRequestIds().call(); // Hypothetical function
        availableNftListEl.innerHTML = ''; // Clear
        if (requestIds.length === 0) {
            availableNftListEl.innerHTML = '<li>No NFT loan requests currently available.</li>';
            return;
        }
        for (const id of requestIds) {
            const loan = await defi_contract.methods.getLoanDetails(id).call();
            if (loan.active && !loan.funded && loan.isNftBased) {
                const listItem = document.createElement('li');
                listItem.innerHTML = `Loan ID: ${loan.loanId}, Borrower: ${loan.borrower}, Amount: ${web3.utils.fromWei(loan.principalAmount, 'ether')} ETH, NFT: ${loan.nftContractAddress} ID: ${loan.nftTokenId}
                                     <button onclick="window.loanByNft('${loan.nftContractAddress}', ${loan.nftTokenId})">Fund this NFT Loan</button>`; // Assuming loanByNft takes these params based on JS stubs
                availableNftListEl.appendChild(listItem);
            }
        }
    } catch (error) {
        console.error("Error fetching available NFT loans:", error);
        if (availableNftListEl) availableNftListEl.innerHTML = '<li>Error fetching NFT loan requests.</li>';
    }
    */
    console.log("Placeholder for getAvailableNfts. Contract needs a way to list pending requests.");
}

async function getTotalBorrowedAndNotPaidBackEth() { // [cite: 62]
    if (!defi_contract || !userAccount) return alert("Connect wallet first.");
    // This requires a specific function in the smart contract, e.g.,
    // `getTotalBorrowedByUser(address user)` or a global `getTotalOutstandingLoansEth()`
    try {
        // Placeholder: const totalBorrowed = await defi_contract.methods.getTotalBorrowedByUser(userAccount).call();
        const totalBorrowedFormatted = "N/A (Contract function needed)"; // web3.utils.fromWei(totalBorrowed, 'ether');
        console.log("Total Borrowed ETH (not paid back):", totalBorrowedFormatted);
        // Update UI
        const myBorrowedDisp = document.getElementById('myBorrowedEthDisplay'); // Assumed ID
        if(myBorrowedDisp) myBorrowedDisp.textContent = `${totalBorrowedFormatted} ETH`;
    } catch (error) {
        console.error("Error fetching total borrowed ETH:", error);
        alert("Error fetching total borrowed ETH: " + error.message);
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

// This function seems redundant if checkLoanStatus is the primary owner action trigger.
// `checkLoan` on the contract is an action.
// async function checkLoan() { /* ... */ }


// --- NFT Contract specific (utility, not directly in PDF for DeFi client) ---
async function getAllTokenURIs() { // Example utility for SimpleNFT
    if (!nft_contract || !userAccount) return alert("Connect wallet and ensure NFT contract is initialized.");
    try {
        const balance = await nft_contract.methods.balanceOf(userAccount).call();
        if (balance === "0") {
            alert("You don't own any NFTs from this collection.");
            return [];
        }
        const uris = [];
        for (let i = 0; i < balance; i++) {
            const tokenId = await nft_contract.methods.tokenOfOwnerByIndex(userAccount, i).call();
            const tokenURI = await nft_contract.methods.tokenURI(tokenId).call();
            uris.push({ tokenId, tokenURI });
            console.log(`Token ID: ${tokenId}, URI: ${tokenURI}`);
        }
        alert(`Fetched URIs for ${balance} NFTs.`);
        // Update UI to display these NFTs
        return uris;
    } catch (error) {
        console.error("Error fetching token URIs:", error);
        alert("Error fetching token URIs: " + error.message);
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
window.returnLoan = returnLoan; // User terminates/repays loan fully (maps to terminateLoan)
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