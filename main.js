const web3 = new Web3(window.ethereum);

// the part is related to the DecentralizedFinance smart contract
const defi_contractAddress = "0x24AA2C7D5A6c927E0aC16629E9bfC45907A0B134";
import { defi_abi } from "./abi_decentralized_finance.js";
const defi_contract = new web3.eth.Contract(defi_abi, defi_contractAddress);

// the part is related to the the SimpleNFT smart contract
const nft_contractAddress = "0xcd1eD0552B0eC0bE90CeAb491d4bd06e83f8Be96";
import { nft_abi } from "./abi_nft.js";
const nft_contract = new web3.eth.Contract(nft_abi, nft_contractAddress);

let connected = false;

async function connectMetaMask() {
    if (window.ethereum) {
        try {
            const accounts = await window.ethereum.request({
                method: "eth_requestAccounts",
            });
            
            const userAddress = accounts[0];
            console.log("Connected account:", userAddress);
            document.getElementById("walletAddress").innerText = "Wallet: " + userAddress;

            if(!connected){
                connected = true;

                await checkAndDisplayOwnerFunctions();
                listenToNftLoanRequests();
                await getRateEthToDex(); // Display initial rate
                await getEthTotalBalance(); // Display contract ETH balance
                await getDex(); // Display user's DEX balance
                await getTotalBorrowedAndNotPaidBackEth();
                await getAllTokenURIs();
                await listMyLoanStatus();  
            }

            
        } catch (error) {
            console.error("Error connecting to MetaMask:", error);
            alert("Error");
        }
    } else {
        console.error("MetaMask not found. Please install the MetaMask extension.");
    }
}

async function checkAndDisplayOwnerFunctions() {
    if (!connected) return alert("Connect wallet first");
    try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        const userAddress = accounts[0];

        const ownerAddress = await defi_contract.methods.owner().call();

        if (userAddress.toLowerCase() === ownerAddress.toLowerCase()) {
            document.getElementById("ownerSection").style.display = "block";

            listenToLoanCreation();
            // Start periodic check
            setInterval(checkLoanStatus, 10 * 60 * 1000); // Every 10 minutes

        } else {
            console.log("Current user is not the owner.");
        }
    } catch (error) {
        console.error("Error checking contract owner:", error);
        alert("Error");
    }
}
async function getRateEthToDex() {
    if (!connected) return alert("Connect wallet first");
    try {
        const rateWeiPerDEX = await defi_contract.methods.dexSwapRate().call(); // This is Wei for 1 whole DEX
        
        const oneEthInWei = web3.utils.toBN(web3.utils.toWei('1', 'ether'));
        const dexPerEth = oneEthInWei.mul(web3.utils.toBN(10).pow(web3.utils.toBN(18))).div(web3.utils.toBN(rateWeiPerDEX)).div(web3.utils.toBN(10).pow(web3.utils.toBN(18))); // Result in whole DEX units

        // Update UI
        const exchangeRateDisp = document.getElementById('exchangeRateDisplay'); // Assumed ID
        if(exchangeRateDisp) exchangeRateDisp.textContent = `1 ETH = ${dexPerEth.toString()} DEX (Raw rate: ${rateWeiPerDEX} Wei = 1 DEX)`;
        return { weiPerDEX: rateWeiPerDEX.toString(), dexPerEth: dexPerEth.toString() };
    } catch (error) {
        console.error("Error fetching exchange rate:", error);
        alert("Error");
    }
}
async function getEthTotalBalance() { 
    if (!connected) return alert("Connect wallet first");
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
        alert("Error");
    }
}

async function setRateEthToDex() {
    if (!connected) return alert("Connect wallet first");
    const newRate = document.getElementById("newExchangeRate").value;
    const accounts = await web3.eth.getAccounts();
    await defi_contract.methods.ownerSetDexSwapRate(newRate).send({ from: accounts[0] });
    await getRateEthToDex();
}


let loanCreationTimeout = null;

async function listenToLoanCreation() {
    if (!connected) return alert("Connect wallet first");
    defi_contract.events.loanCreated()
        .on("data", (event) => {
            // Clear any existing scheduled execution
            if (loanCreationTimeout) clearTimeout(loanCreationTimeout);

            // Schedule a new execution after 200ms
            loanCreationTimeout = setTimeout(() => {
                handleLoanCreation(event);
                
            }, 300); // Adjust delay if needed
            
        })
        .on("error", console.error);
}

async function handleLoanCreation(event) {
    if (!connected) return alert("Connect wallet first");
    const imagesDiv = document.getElementById("loanCreatedList");
    imagesDiv.innerHTML = ""; // Clear existing content
    const { loanId, borrower, amount, deadline } = event.returnValues;
    console.log("Processing loanCreated event");

    const formattedAmount = web3.utils.fromWei(amount, "ether");
    const formattedDeadline = new Date(deadline * 1000).toLocaleString();

    const listItem = document.createElement("li");
    listItem.innerHTML = `
        <strong>Loan Id:</strong> ${loanId}<br>
        <strong>Borrower:</strong> ${borrower}<br>
        <strong>Loan Amount:</strong> ${formattedAmount} ETH<br>
        <strong>Deadline:</strong> ${formattedDeadline}
    `;

    document.getElementById("loanCreatedList").appendChild(listItem);

    
    await getDex();
    await getTotalBorrowedAndNotPaidBackEth();
    await getAllTokenURIs();
    await getEthTotalBalance();
}

let nftLoanUpdateTimeout = null;

async function listenToNftLoanRequests() {
    if (!connected) return alert("Connect wallet first");
    defi_contract.events.nftLoanRequestCreated({ fromBlock: 0 })
        .on('data', (event) => {
            console.log("Event received:", event.returnValues);

            // Debounce: schedule update after 300ms, cancel if another comes in before that
            if (nftLoanUpdateTimeout) clearTimeout(nftLoanUpdateTimeout);
            nftLoanUpdateTimeout = setTimeout(() => {
                updateAvailableNftLoans();
                nftLoanUpdateTimeout = null;
            }, 300); // adjust delay if needed
        })
        .on('error', console.error);
}

// Load loans with no lender and update HTML
async function updateAvailableNftLoans() {
    if (!connected) return alert("Connect wallet first");
    const totalTokens = await nft_contract.methods.tokenIdCounter().call();
    const totalLoans = await defi_contract.methods.loanCounter().call();
    const tokenURIs = [];
    const imagesDiv = document.getElementById("availableNFTLoans");

    imagesDiv.innerHTML = ""; // Clear existing content
    
    // Busca um empréstimo para esse token que esteja ativo e sem lender
    for (let i = 1; i <= totalLoans; i++) {
        
            const loan = await defi_contract.methods.loans(i).call();
            if (
                parseInt(loan.nftId) !== 0 &&
                loan.lender === "0x0000000000000000000000000000000000000000" &&
                loan.isActive

            ) {

                try {
                    const tokenURI = await nft_contract.methods.tokenURI(loan.nftId).call();
                    tokenURIs.push(tokenURI);

                    const response = await fetch(tokenURI);
                    const imageBlob = await response.blob();
                    const objectURL = URL.createObjectURL(imageBlob);

                    const image = document.createElement("img");
                    image.src = objectURL;
                    image.alt = `NFT #${loan.nftId}`;
                    image.width = 200;
                    image.height = 200;

                    const tokenIdElem = document.createElement("div");
                    tokenIdElem.className = "nft-id";
                    tokenIdElem.textContent = `Token ID: ${loan.nftId}`;

                    const loanIdElem = document.createElement("div");
                    loanIdElem.className = "loan-id";
                    loanIdElem.textContent = `Loan ID: ${i}`;

                    const priceElem = document.createElement("div");
                    priceElem.className = "nft-price";
                    priceElem.textContent = `Loan required value: ${loan.amount} Wei`;


                    const listItem = document.createElement("li");
                    listItem.className = "nft-item";
                    listItem.appendChild(image);
                    listItem.appendChild(tokenIdElem);
                    listItem.appendChild(loanIdElem);
                    listItem.appendChild(priceElem);

                    imagesDiv.appendChild(listItem);
                } catch (error) {
                    console.error(`Error loading metadata for token ${loan.nftId}: ${error}`);
                    alert("Error");
                }

            }
        
    }
            
}


async function checkLoanStatus() {
    if (!connected) return alert("Connect wallet first");

    const accounts = await web3.eth.getAccounts();
    const totalLoans = await defi_contract.methods.loanCounter().call();
    const loanList = document.getElementById("trackedLoansList");
    loanList.innerHTML = ""; // Clear previous results

    for (let i = 1; i <= totalLoans; i++) {
        try {
            const receipt = await defi_contract.methods.checkLoan(i).send({ from: accounts[0] });

            // Parse events from the receipt (if emitted)
            const loanEvent = receipt.events?.LoanChecked?.returnValues;
            if (loanEvent) {
                const { loanId, borrower, isActive, wasPunished } = loanEvent;

                const li = document.createElement("li");
                li.innerText = `Loan #${loanId} | Borrower: ${borrower} | Active: ${isActive} | Punished: ${wasPunished}`;
                loanList.appendChild(li);
            } else {
                // Fallback if no event: just log checked
                const li = document.createElement("li");
                li.innerText = `Loan #${i} checked successfully (no event emitted)`;
                loanList.appendChild(li);
            }

        }  catch (err) {
            console.error("Error making NFT-backed loan request:", err);
            alert("Error");
        }
    }
    await listMyLoanStatus();
}

async function listMyLoanStatus() {
    if (!connected) return alert("Connect wallet first");

    const accounts = await web3.eth.getAccounts();
    const user = accounts[0];

    const loanList = document.getElementById("myLoansStatus");
    loanList.innerHTML = ""; // Clear previous content

    try {
        const totalLoans = await defi_contract.methods.loanCounter().call();

        for (let i = 1; i <= totalLoans; i++) {
            const loan = await defi_contract.methods.loans(i).call();

            if (loan.borrower.toLowerCase() === user.toLowerCase()) {
                const status = loan.isActive
                    ? (loan.lender === "0x0000000000000000000000000000000000000000"
                        ? "Open (waiting for lender)"
                        : "Active (funded)")
                    : "Closed";

                const deadline = new Date(loan.deadline * 1000).toLocaleString();

                const li = document.createElement("li");
                li.className = "nft-item"; // Optional: match styling
                li.innerHTML = `
                    <strong>Loan ID:</strong> ${i}<br>
                    <strong>NFT ID:</strong> ${loan.nftId}<br>
                    <strong>Amount:</strong> ${web3.utils.fromWei(loan.amount, "ether")} ETH<br>
                    <strong>Deadline:</strong> ${deadline}<br>
                    <strong>Status:</strong> ${status}
                `;

                loanList.appendChild(li);
            }
        }
    } catch (err) {
        console.error("Error fetching your loan statuses:", err);
        alert("Error");
    }
}


async function buyDex() {
    if (!connected) return alert("Connect wallet first");

    const accounts = await web3.eth.getAccounts();
    const amount = document.getElementById("buyDexAmountWei").value;
    const unitAmount = document.getElementById('buyDexAmountWeiUnit').value;

    let amountWei;
    switch (unitAmount) {
        case 'ETH':  amountWei = web3.utils.toWei(amount, 'ether'); break;
        case 'Wei': amountWei = amount; break;
    }

    await defi_contract.methods.buyDex().send({
        from: accounts[0],
        value: amountWei
    });
    await getDex();
    await getEthTotalBalance();
}

async function getDex() {
    if (!connected) return alert("Connect wallet first");

    const accounts = await web3.eth.getAccounts();
    const balance = await defi_contract.methods.getDexBalance().call({ from: accounts[0] });
    document.getElementById('myDexBalanceDisplay').textContent = `${balance}`;
      
}

async function sellDex() {
    if (!connected) return alert("Connect wallet first");

    const accounts = await web3.eth.getAccounts();
    const amountInWei = document.getElementById("sellDexAmountDex").value;
    await defi_contract.methods.sellDex(amountInWei).send({ from: accounts[0] });
    await getDex(); 
    await getEthTotalBalance();
}

async function loan() {
    if (!connected) return alert("Connect wallet first");

    const accounts = await web3.eth.getAccounts();
    const amountInDex = document.getElementById("loanDexAmount").value;
    const deadline = document.getElementById("loanDexDeadline").value;
    const unitDeadline = document.getElementById('loanDexDeadlineUnit').value;

    let deadlineTimestamp;
    
    switch (unitDeadline.toLowerCase()) {
        case 'days':
            deadlineTimestamp = Math.floor(Date.now() / 1000) + deadline * 24 * 60 * 60;
            break;
        case 'weeks':
            deadlineTimestamp = Math.floor(Date.now() / 1000) + deadline * 7 * 24 * 60 * 60;
            break;
        case 'minutes':
            deadlineTimestamp = Math.floor(Date.now() / 1000) + deadline * 60;
            break;
    }

    // Convert current time to Unix timestamp in seconds
    await defi_contract.methods.loan(amountInDex, deadlineTimestamp).send({ from: accounts[0] });

    await getDex();
    await getTotalBorrowedAndNotPaidBackEth();
    await listMyLoanStatus();
}

async function makePeriodicPayment() {
    if (!connected) return alert("Connect wallet first");

    const loanId = document.getElementById("periodicPaymentLoanId").value;
    const ethAmount = document.getElementById("periodicPaymentAmountEth").value;
    const accounts = await web3.eth.getAccounts();

    await defi_contract.methods.makePayment(loanId).send({
        from: accounts[0],
        value: ethAmount
    });

    await getDex();
    await getTotalBorrowedAndNotPaidBackEth();
    await listMyLoanStatus();
    await getEthTotalBalance();
}

async function terminateLoan() {
    if (!connected) return alert("Connect wallet first");

    const loanId = document.getElementById("returnLoanId").value;
    const amount = document.getElementById("returnLoanAmount").value;

    const unitAmount = document.getElementById('returnLoanAmountUnit').value;

    let amountWei;
    switch (unitAmount) {
        case 'ETH':  amountWei = web3.utils.toWei(amount, 'ether'); break;
        case 'Wei': amountWei = amount; break;
    }

    const accounts = await web3.eth.getAccounts();

    await defi_contract.methods.terminateLoan(loanId).send({
        from: accounts[0],
        value: amountWei
    });

    await getDex();
    await getTotalBorrowedAndNotPaidBackEth();
    await listMyLoanStatus();
    await getEthTotalBalance();
}

async function getTotalBorrowedAndNotPaidBackEth() {
    if (!connected) return alert("Connect wallet first");

    const accounts = await web3.eth.getAccounts();
    const currentUser = accounts[0];

    const totalLoans = await defi_contract.methods.loanCounter().call();
    let total = web3.utils.toBN("0");

    for (let i = 1; i <= totalLoans; i++) {
        const ln = await defi_contract.methods.loans(i).call();

        if (
            ln.isActive &&
            ln.lender !== "0x0000000000000000000000000000000000000000" &&
            ln.borrower.toLowerCase() === currentUser.toLowerCase()
        ) {
            total = total.add(web3.utils.toBN(ln.amount));
        }
    }

    document.getElementById('myBorrowedEthDisplay').textContent = `${total} `;
}

async function requestLoanUsingNFT() {
    if (!connected) return alert("Connect wallet first");

    const accounts = await web3.eth.getAccounts();
    const user = accounts[0];

    const nftId = document.getElementById("nftLoanId").value;
    const loanAmount = document.getElementById("nftLoanAmount").value;
    const unitAmount = document.getElementById('nftLoanAmountUnit').value;

    let loanAmountWei;
    switch (unitAmount) {
        case 'ETH':  loanAmountWei = web3.utils.toWei(loanAmount, 'ether'); break;
        case 'Wei': loanAmountWei = loanAmount; break;
    }

    const deadline = parseInt(document.getElementById('nftLoanDeadlineValue').value);
    const unitDeadline = document.getElementById('nftLoanDeadlineUnit').value;

    let deadlineTimestamp;
    
    switch (unitDeadline.toLowerCase()) {
        case 'days':
            deadlineTimestamp = Math.floor(Date.now() / 1000) + deadline * 24 * 60 * 60;
            break;
        case 'weeks':
            deadlineTimestamp = Math.floor(Date.now() / 1000) + deadline * 7 * 24 * 60 * 60;
            break;
        case 'minutes':
            deadlineTimestamp = Math.floor(Date.now() / 1000) + deadline * 60;
            break;
    }

    try {
        const totalLoans = await defi_contract.methods.loanCounter().call();

        // Verifica se há algum empréstimo ativo com esse NFT
        for (let i = 1; i <= totalLoans; i++) {
            const loan = await defi_contract.methods.loans(i).call();
            if (loan.nftId === nftId && loan.isActive) {
                alert("This NFT is already being used in an active loan.");
                return;
            }
        }

        // Aprova o contrato e faz o pedido
        await nft_contract.methods.approve(defi_contractAddress, nftId).send({ from: user });

        await defi_contract.methods
            .makeLoanRequestByNft(nft_contractAddress, nftId, loanAmountWei, deadlineTimestamp)
            .send({ from: user });

    } catch (err) {
        console.error("Error making NFT-backed loan request:", err);
        alert("Error");
    }

    await listMyLoanStatus();
}


async function cancelLoanRequestByNft() {
    if (!connected) return alert("Connect wallet first");

    const nftId = document.getElementById("cancelNFTId").value;

    try {
        const accounts = await web3.eth.getAccounts();
        const userAddress = accounts[0];

        // Call the cancelLoanRequestByNft method
        await defi_contract.methods.cancelLoanRequestByNft(nft_contractAddress, nftId)
            .send({ from: userAddress });

        alert(`Loan request for NFT ID ${nftId} has been canceled.`);
    } catch (error) {
        console.error("Error cancelling NFT loan request:", error);
        alert("Error");
    }

    await updateAvailableNftLoans();
    await listMyLoanStatus();
}

async function loanByNft() {
    if (!connected) return alert("Connect wallet first");

    const nftId = document.getElementById("fundNftLoanId").value;
    try {
        const accounts = await web3.eth.getAccounts();
        const lender = accounts[0];

        // Agora empresta os tokens chamando loanByNft
        await defi_contract.methods.loanByNft(nft_contractAddress, nftId)
            .send({ from: lender });

    } catch (error) {
        console.error("Error funding NFT loan:", error);
        alert("Failed to fund the loan.");
    }

    await getDex();
    await getTotalBorrowedAndNotPaidBackEth();
    await updateAvailableNftLoans();
}

async function mintNFT() {
    if (!connected) return alert("Connect wallet first");

    const accounts = await web3.eth.getAccounts();
    const user = accounts[0];
    const tokenURI = document.getElementById("tokenURI").value;
    if (!tokenURI) {
        alert("Please enter a token URI");
        return;
    }

    try {
        await nft_contract.methods.mint(tokenURI).send({
            from: user,
            value: 1000,
        });
    } catch (error) {
        console.error("Error minting NFT:", error);
        alert("Error");
    }
    await getAllTokenURIs();
}

async function getAllTokenURIs() {
    if (!connected) return alert("Connect wallet first");

    const totalTokens = await nft_contract.methods.tokenIdCounter().call();
    const tokenURIs = [];
    const imagesDiv = document.getElementById("myNftList");

    imagesDiv.innerHTML = ""; // Clear previous NFTs

    const accounts = await web3.eth.getAccounts();
    const userAddress = accounts[0];

    try {
        for (let tokenId = 1; tokenId <= totalTokens; tokenId++) {
            const owner = await nft_contract.methods.ownerOf(tokenId).call();
            if (owner.toLowerCase() !== userAddress.toLowerCase()) {
                continue; // Skip if not owned by the user
            }

            const tokenURI = await nft_contract.methods.tokenURI(tokenId).call();
            tokenURIs.push(tokenURI);

            try {
                const response = await fetch(tokenURI);
                const imageBlob = await response.blob();
                const objectURL = URL.createObjectURL(imageBlob);

                const image = document.createElement("img");
                image.src = objectURL;
                image.alt = `NFT #${tokenId}`;
                image.width = 200;
                image.height = 200;

                const tokenIdElem = document.createElement("div");
                tokenIdElem.className = "nft-id";
                tokenIdElem.textContent = `Token ID: ${tokenId}`;

                const priceElem = document.createElement("div");
                priceElem.className = "nft-price";

                const listItem = document.createElement("li");
                listItem.className = "nft-item";
                listItem.appendChild(image);
                listItem.appendChild(tokenIdElem);

                imagesDiv.appendChild(listItem);
            } catch (error) {
                console.error(`Error fetching image for token ${tokenId}: ${error}`);
                alert("Error");
            }
        }

        return tokenURIs;
    } catch (error) {
        console.error("Error fetching token URIs:", error);
        alert("Error");
    }
}


window.connectMetaMask = connectMetaMask;
window.setRateEthToDex = setRateEthToDex;
window.buyDex = buyDex;
window.sellDex = sellDex;
window.loan = loan;
window.terminateLoan = terminateLoan;
window.makePeriodicPayment = makePeriodicPayment;
window.mintNFT = mintNFT;
window.requestLoanUsingNFT = requestLoanUsingNFT;
window.cancelLoanRequestByNft = cancelLoanRequestByNft;
window.loanByNft = loanByNft;