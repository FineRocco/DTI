// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract DecentralizedFinance is ERC20, Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // --- Structs ---
    // User-defined minimal struct
    struct Loan {
        uint256 deadline;       // deadlineTimestamp
        uint256 amount;         // principalAmount
        address lender;
        address borrower;
        bool isNftBased;        // Corrected from isBasedNft
        address nftContractAddress; // Storing address, will cast to IERC721
        uint256 nftId;
        bool isActive;          // Replaces 'active'
        uint256 lastPayment;    // lastPaymentTimestamp
    }

    // --- Constants ---
    uint256 public constant PERCENTAGE_SCALE = 10000;
    uint256 public constant LTV_DEX_PERCENT = 50;
    uint256 public constant SECONDS_IN_YEAR = 365 days;

    // --- State Variables ---
    uint256 public maxLoanDurationSeconds;
    uint256 public dexToWeiSwapRate;

    mapping(uint256 => Loan) public loans;
    uint256 private _nextLoanId;

    // Global loan terms (will apply to all loans dynamically if changed by owner)
    uint256 public globalPeriodicitySeconds;
    uint256 public globalInterestRateBps;      // Annual interest rate
    uint256 public globalTerminationFeeWei;

    mapping(address => mapping(uint256 => uint256)) public nftLoanRequestLoanId;

    // Separate mappings for data removed from struct
    mapping(uint256 => uint256) internal loanIdToDexCollateralAmount;
    mapping(uint256 => uint256) internal loanIdToLenderDexStake;
    mapping(uint256 => uint256) internal loanIdToFundingTimestamp; // To know when a loan truly started for payment cycles

    // --- Events ---
    event LoanCreated(address indexed borrower, uint256 amount, uint256 deadline);
    event LoanRequested(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 deadlineTimestamp, bool isNftBased);
    event LoanFunded(uint256 indexed loanId, address indexed lender, uint256 principalAmount);
    event LoanTerminated(uint256 indexed loanId, address indexed borrower, uint256 terminationFeePaid);
    event LoanLiquidated(uint256 indexed loanId, address indexed by, address indexed borrower);
    event DexSwapRateChanged(uint256 oldRate, uint256 newRate);
    event PeriodicPaymentMade(uint256 indexed loanId, address indexed borrower, uint256 paymentAmount); // Removed cycleNumber
    event LoanRequestCancelled(uint256 indexed loanId, address indexed requester);


    constructor(
        uint256 initialDexToWeiRate,
        uint256 _globalPeriodicitySeconds,
        uint256 _globalInterestRateBps,
        uint256 _globalTerminationFeeWei
    ) ERC20("DEX Token", "DEX") Ownable(msg.sender) {
        _mint(msg.sender, 1_000_000 * (10**decimals()));

        require(initialDexToWeiRate > 0, "Initial DEX rate must be > 0");
        dexToWeiSwapRate = initialDexToWeiRate;
        emit DexSwapRateChanged(0, dexToWeiSwapRate);

        globalPeriodicitySeconds = _globalPeriodicitySeconds;
        globalInterestRateBps = _globalInterestRateBps;
        globalTerminationFeeWei = _globalTerminationFeeWei;
        maxLoanDurationSeconds = 365 days * 2;
        _nextLoanId = 1;
    }

    // --- Internal Helper: Calculate total loan cycles (approximate with current info) ---
    function _getLoanFundingTimestamp(uint256 loanId) internal view returns (uint256) {
        return loanIdToFundingTimestamp[loanId];
    }

    // --- DEX Swapping (largely unchanged, ensure helpers are fine) ---
    function _calculateDexToReceive(uint256 ethAmountWei) internal view returns (uint256) {
        return ethAmountWei.mul(10**decimals()).div(dexToWeiSwapRate);
    }

    function buyDex() external payable nonReentrant {
        require(msg.value > 0, "Must send ETH to buy DEX");
        require(dexToWeiSwapRate > 0, "Swap rate not set");
        uint256 dexAmountInSmallestUnits = _calculateDexToReceive(msg.value);
        require(dexAmountInSmallestUnits > 0, "ETH sent too low for any DEX");
        require(balanceOf(address(this)) >= dexAmountInSmallestUnits, "Contract has insufficient DEX reserves");
        _transfer(address(this), msg.sender, dexAmountInSmallestUnits);
        _updateDexSwapRate(true, msg.value, dexAmountInSmallestUnits);
    }

    function _calculateEthToReceiveForDex(uint256 dexAmountSmallestUnits) internal view returns (uint256) {
        return dexAmountSmallestUnits.mul(dexToWeiSwapRate).div(10**decimals());
    }

    function _disburseEth(address recipient, uint256 amountWei) internal {
        payable(recipient).transfer(amountWei);
    }

    function sellDex(uint256 dexAmountToSellInSmallestUnits) external nonReentrant {
        require(dexAmountToSellInSmallestUnits > 0, "Must sell a positive amount of DEX");
        require(dexToWeiSwapRate > 0, "Swap rate not set");
        uint256 ethValueInWei = _calculateEthToReceiveForDex(dexAmountToSellInSmallestUnits);
        require(ethValueInWei > 0, "DEX amount too low for any ETH");
        require(address(this).balance >= ethValueInWei, "Contract has insufficient ETH balance");
        _transfer(msg.sender, address(this), dexAmountToSellInSmallestUnits);
        _disburseEth(msg.sender, ethValueInWei);
        _updateDexSwapRate(false, ethValueInWei, dexAmountToSellInSmallestUnits);
    }

    // --- Loan Functions (DEX Collateral) ---
    function _validateAndCalculateDEXLoan(uint256 dexAmountCollateralInSmallestUnits, uint256 desiredDeadlineTimestamp)
        internal view returns (uint256 principalLoanAmount) // Removed loanDurationSeconds return
    {
        require(dexAmountCollateralInSmallestUnits > 0, "DEX collateral amount must be > 0");
        uint256 loanDurationSeconds = desiredDeadlineTimestamp.sub(block.timestamp);
        require(desiredDeadlineTimestamp > block.timestamp && loanDurationSeconds <= maxLoanDurationSeconds, "Invalid loan deadline");
        require(dexToWeiSwapRate > 0, "Swap rate not set");
        uint256 collateralValueWei = _calculateEthToReceiveForDex(dexAmountCollateralInSmallestUnits);
        require(collateralValueWei > 0, "Collateral value too low");
        principalLoanAmount = collateralValueWei.mul(LTV_DEX_PERCENT).div(100);
        require(principalLoanAmount > 0, "Loan amount would be zero");
        require(address(this).balance >= principalLoanAmount, "Contract insufficient ETH for loan");
    }

    function _storeDEXLoan(
        uint256 currentLoanId,
        uint256 dexAmountCollateral,
        uint256 desiredDeadline,
        uint256 principalLoanAmt
    ) internal {
        loans[currentLoanId] = Loan({
            borrower: msg.sender,
            lender: address(this), // Contract is lender
            amount: principalLoanAmt,
            deadline: desiredDeadline,
            // Interest, Periodicity, TerminationFee will be read from globals
            isNftBased: false,
            nftContractAddress: address(0),
            nftId: 0,
            isActive: true,
            lastPayment: block.timestamp // Initialized to funding time
        });
        loanIdToDexCollateralAmount[currentLoanId] = dexAmountCollateral;
        loanIdToFundingTimestamp[currentLoanId] = block.timestamp; // Explicitly store funding time
    }

    function loan(uint256 dexAmountCollateralInSmallestUnits, uint256 desiredDeadlineTimestamp) external nonReentrant returns (uint256 loanId) {
        uint256 principalLoanAmountWei = _validateAndCalculateDEXLoan(dexAmountCollateralInSmallestUnits, desiredDeadlineTimestamp);
        _transfer(msg.sender, address(this), dexAmountCollateralInSmallestUnits); // Escrow DEX
        
        loanId = _nextLoanId++;
        _storeDEXLoan(loanId, dexAmountCollateralInSmallestUnits, desiredDeadlineTimestamp, principalLoanAmountWei);
        _disburseEth(msg.sender, principalLoanAmountWei);

        emit LoanCreated(msg.sender, principalLoanAmountWei, desiredDeadlineTimestamp); // PDF Event
        emit LoanRequested(loanId, msg.sender, principalLoanAmountWei, desiredDeadlineTimestamp, false);
        emit LoanFunded(loanId, address(this), principalLoanAmountWei);
        _updateDexSwapRate(false, principalLoanAmountWei, 0);
        return loanId;
    }

    // Periodic Interest Payment
    function _getPeriodicInterestPayment(Loan storage currentLoan) internal view returns (uint256) {
        // Uses global terms
        return currentLoan.amount
            .mul(globalInterestRateBps).div(PERCENTAGE_SCALE)
            .mul(globalPeriodicitySeconds).div(SECONDS_IN_YEAR);
    }

    function _handleFinalPaymentAndCollateralReturn(uint256 loanId, Loan storage currentLoan, uint256 interestPaymentForPeriod) internal {
        uint256 finalPrincipalPayment = currentLoan.amount; // Repay full principal
        uint256 totalFinalDue = interestPaymentForPeriod.add(finalPrincipalPayment);
        require(msg.value >= totalFinalDue, "Insufficient ETH for final payment");

        currentLoan.isActive = false;

        if (!currentLoan.isNftBased) {
            uint256 dexCollateral = loanIdToDexCollateralAmount[loanId];
            if (dexCollateral > 0) {
                _transfer(address(this), currentLoan.borrower, dexCollateral);
            }
        } else { // NFT-based
            IERC721(currentLoan.nftContractAddress).safeTransferFrom(address(this), currentLoan.borrower, currentLoan.nftId);
            uint256 lenderStake = loanIdToLenderDexStake[loanId];
            if (lenderStake > 0 && currentLoan.lender != address(0)) {
                _transfer(address(this), currentLoan.lender, lenderStake);
                loanIdToLenderDexStake[loanId] = 0;
            }
        }
        emit LoanTerminated(loanId, msg.sender, 0); // Normal completion, no termination fee

        if (msg.value > totalFinalDue) {
            _disburseEth(msg.sender, msg.value.sub(totalFinalDue));
        }
    }

    function makePayment(uint256 loanId) external payable nonReentrant { // [cite: 43]
        Loan storage currentLoan = loans[loanId];
        require(currentLoan.isActive && currentLoan.lender != address(0), "Loan not active or not funded");
        require(currentLoan.borrower == msg.sender, "Not the borrower");
        require(block.timestamp <= currentLoan.deadline, "Loan past deadline for periodic payments"); // [cite: 15]
        require(globalPeriodicitySeconds > 0, "Loan has no periodic payments defined");

        uint256 fundingTime = _getLoanFundingTimestamp(loanId);
        require(fundingTime > 0, "Loan funding time not recorded");

        // Simplified check for "all cycles paid": if current payment would push us past deadline.
        // More robust cycle tracking is lost without 'cyclesPaid' and 'totalCycles' in struct.
        bool isConsideredFinalPaymentCycle = (currentLoan.lastPayment + globalPeriodicitySeconds >= currentLoan.deadline);


        uint256 interestPaymentForPeriod = _getPeriodicInterestPayment(currentLoan);

        if (isConsideredFinalPaymentCycle && block.timestamp.add(globalPeriodicitySeconds) >= currentLoan.deadline ) { // Close enough to deadline
            _handleFinalPaymentAndCollateralReturn(loanId, currentLoan, interestPaymentForPeriod);
        } else {
            require(msg.value >= interestPaymentForPeriod, "Insufficient ETH for periodic interest");
            if (msg.value > interestPaymentForPeriod) {
                _disburseEth(msg.sender, msg.value.sub(interestPaymentForPeriod));
            }
        }

        currentLoan.lastPayment = block.timestamp; // Update last payment time

        emit PeriodicPaymentMade(loanId, msg.sender, interestPaymentForPeriod); // Cycle number removed
        _updateDexSwapRate(true, msg.value, 0);
    }

    function _processDEXCollateralReturnOnTermination(uint256 loanId, Loan storage currentLoan) internal {
        uint256 dexCollateral = loanIdToDexCollateralAmount[loanId];
        _transfer(address(this), currentLoan.borrower, dexCollateral);
    }

    function terminateLoan(uint256 loanId) external payable nonReentrant { // [cite: 45]
        Loan storage currentLoan = loans[loanId];
        require(currentLoan.isActive && currentLoan.lender != address(0), "Loan not active or not funded");
        require(currentLoan.borrower == msg.sender, "Not the borrower");
        require(!currentLoan.isNftBased, "Only for DEX-based loans"); // [cite: 46]

        uint256 totalDue = currentLoan.amount.add(globalTerminationFeeWei); // Use global fee [cite: 47]
        require(msg.value >= totalDue, "Insufficient ETH sent for full repayment and fee");

        currentLoan.isActive = false;
        _processDEXCollateralReturnOnTermination(loanId, currentLoan); // [cite: 45]

        if (msg.value > totalDue) {
            _disburseEth(msg.sender, msg.value.sub(totalDue));
        }
        emit LoanTerminated(loanId, msg.sender, globalTerminationFeeWei);
        _updateDexSwapRate(true, totalDue, 0);
    }


    // --- Loan Functions (NFT Collateral) ---
    function _validateNFTLoanRequestInputs(address nftContractAddr, uint256 nftTokenIdParam, uint256 desiredLoanAmt, uint256 desiredDeadline)
        internal view
    {
        require(nftContractAddr != address(0), "Invalid NFT contract address");
        require(desiredLoanAmt > 0, "Loan amount must be > 0");
        uint256 loanDurationSeconds = desiredDeadline.sub(block.timestamp);
        require(desiredDeadline > block.timestamp && loanDurationSeconds <= maxLoanDurationSeconds, "Invalid loan deadline");
        require(IERC721(nftContractAddr).ownerOf(nftTokenIdParam) == msg.sender, "Caller does not own the NFT");
    }

    function _storeNFTLoanRequest(
        uint256 currentLoanId,
        address nftContractAddr,
        uint256 nftTokenIdParam,
        uint256 desiredLoanAmt,
        uint256 desiredDeadline
    ) internal {
        loans[currentLoanId] = Loan({
            borrower: msg.sender,
            lender: address(0), // No lender yet [cite: 52]
            amount: desiredLoanAmt,
            deadline: desiredDeadline,
            isNftBased: true,
            nftContractAddress: nftContractAddr, // [cite: 18]
            nftId: nftTokenIdParam, // [cite: 19]
            isActive: true, // Active as a request
            lastPayment: 0 // Will be set upon funding
            // Other fields like interest, periodicity, termination are global
        });
        nftLoanRequestLoanId[nftContractAddr][nftTokenIdParam] = currentLoanId;
        loanIdToFundingTimestamp[currentLoanId] = block.timestamp; // Request creation time for now, updated on funding
    }

    function makeLoanRequestByNft( // [cite: 50]
        IERC721 _nftContractInput, // Changed type to IERC721 as per user struct request
        uint256 _nftIdInput,
        uint256 _desiredLoanAmountWei,
        uint256 _desiredDeadlineTimestamp
    ) external nonReentrant returns (uint256 loanId) {
        address nftContractAddr = address(_nftContractInput);
        _validateNFTLoanRequestInputs(nftContractAddr, _nftIdInput, _desiredLoanAmountWei, _desiredDeadlineTimestamp);
        
        loanId = _nextLoanId++;
        _storeNFTLoanRequest(loanId, nftContractAddr, _nftIdInput, _desiredLoanAmountWei, _desiredDeadlineTimestamp);

        emit LoanCreated(msg.sender, _desiredLoanAmountWei, _desiredDeadlineTimestamp); // [cite: 59]
        emit LoanRequested(loanId, msg.sender, _desiredLoanAmountWei, _desiredDeadlineTimestamp, true);
        return loanId;
    }

    function cancelLoanRequestByNft(IERC721 _nftContractInput, uint256 _nftIdInput) external nonReentrant { // [cite: 52]
        address nftContractAddr = address(_nftContractInput);
        uint256 loanId = nftLoanRequestLoanId[nftContractAddr][_nftIdInput]; //
        require(loanId != 0, "No loan request found for this NFT");

        Loan storage currentLoan = loans[loanId];
        require(currentLoan.borrower == msg.sender, "Not the requester");
        require(currentLoan.isActive && currentLoan.lender == address(0), "Loan not an active unfunded request");
        require(currentLoan.isNftBased && currentLoan.nftContractAddress == nftContractAddr && currentLoan.nftId == _nftIdInput, "NFT details mismatch");

        currentLoan.isActive = false;
        delete nftLoanRequestLoanId[nftContractAddr][_nftIdInput];
        emit LoanRequestCancelled(loanId, msg.sender);
    }

    function _validateNftLoanForFunding(Loan storage currentLoan, address nftContractAddrParam, uint256 nftTokenIdParam) internal view {
        require(currentLoan.isActive && currentLoan.lender == address(0), "Loan request not active or already funded");
        require(currentLoan.isNftBased && currentLoan.nftContractAddress == nftContractAddrParam && currentLoan.nftId == nftTokenIdParam, "NFT details mismatch for funding");
        require(currentLoan.borrower != msg.sender, "Cannot lend to yourself");
        require(msg.value == currentLoan.amount, "Incorrect ETH amount sent to fund loan");
    }

    function _processLenderDEXStakeForNFTLoan(uint256 loanId, uint256 lenderDexStakeAmount) internal { //
        require(balanceOf(msg.sender) >= lenderDexStakeAmount, "Lender has insufficient DEX to stake");
        _transfer(msg.sender, address(this), lenderDexStakeAmount); // Lock lender's DEX [cite: 54]
        loanIdToLenderDexStake[loanId] = lenderDexStakeAmount;
    }

    function _escrowBorrowerNftCollateral(Loan storage currentLoan) internal { //
        IERC721 nftContract = IERC721(currentLoan.nftContractAddress);
        require(nftContract.ownerOf(currentLoan.nftId) == currentLoan.borrower, "Borrower no longer owns the NFT");
        require(nftContract.getApproved(currentLoan.nftId) == address(this) ||
                nftContract.isApprovedForAll(currentLoan.borrower, address(this)),
            "Contract not approved to transfer NFT");
        nftContract.safeTransferFrom(currentLoan.borrower, address(this), currentLoan.nftId);
    }

    function loanByNft(IERC721 _nftContractInput, uint256 _nftIdInput, uint256 lenderDexStakeAmount) external payable nonReentrant { // [cite: 54]
        address nftContractAddr = address(_nftContractInput);
        uint256 loanId = nftLoanRequestLoanId[nftContractAddr][_nftIdInput];
        require(loanId != 0, "No loan request found for this NFT to fund");
        Loan storage currentLoan = loans[loanId];

        _validateNftLoanForFunding(currentLoan, nftContractAddr, _nftIdInput);
        _processLenderDEXStakeForNFTLoan(loanId, lenderDexStakeAmount);
        _escrowBorrowerNftCollateral(currentLoan);

        currentLoan.lender = msg.sender; // [cite: 54]
        loanIdToFundingTimestamp[loanId] = block.timestamp; // Set/Update funding time
        currentLoan.lastPayment = block.timestamp; // Payments cycle starts now

        _disburseEth(currentLoan.borrower, currentLoan.amount);
        emit LoanFunded(loanId, msg.sender, currentLoan.amount);
    }


    // --- Loan Management by Owner ---
    function _isLoanDefaulted(uint256 loanId, Loan storage currentLoan) internal view returns (bool) { //
        bool missedPeriodicPayment = false;
        if (globalPeriodicitySeconds > 0 && currentLoan.lender != address(0)) { // Check if funded
            uint256 fundingTime = _getLoanFundingTimestamp(loanId);
            if (fundingTime > 0 && block.timestamp > currentLoan.lastPayment.add(globalPeriodicitySeconds)) {
                 // This condition means the time since last payment is greater than one period.
                 // It doesn't inherently know how many payments were expected vs made without cyclesPaid/totalCycles.
                 // A simple check: if last payment was too long ago and deadline not reached.
                if (block.timestamp < currentLoan.deadline) { // If before overall deadline
                     missedPeriodicPayment = true; // [cite: 31]
                }
            }
        }
        bool pastFinalDeadlineUnpaid = false;
        if (block.timestamp > currentLoan.deadline && currentLoan.isActive && currentLoan.lender != address(0) ) { // If active and funded past deadline [cite: 32,33,58]
            pastFinalDeadlineUnpaid = true;
        }
        return missedPeriodicPayment || pastFinalDeadlineUnpaid;
    }

    function _liquidateLoan(uint256 loanId, Loan storage currentLoan) internal { //
        currentLoan.isActive = false;

        if (currentLoan.isNftBased) {
            require(currentLoan.lender != address(0), "NFT loan has no lender to receive collateral");
            IERC721(currentLoan.nftContractAddress).safeTransferFrom(address(this), currentLoan.lender, currentLoan.nftId); // [cite: 56]
            // "and keeps the staked DEX tokens" (contract keeps lender B's DEX stake) [cite: 56]
            // The stake is already held by the contract at loanIdToLenderDexStake[loanId].
            // If it's "kept by contract", no further action. If it means returned to lender if borrower doesn't default, that's different.
            // PDF [cite: 55] "if A repays ... releases ... staked DEX tokens back to their owners" (lender B gets their DEX back)
            // PDF [cite: 56] "if A fails ... keeps the staked DEX tokens" (Contract keeps B's DEX)
            // So, on liquidation (A fails), contract keeps it. No transfer out from loanIdToLenderDexStake.
        } else { // DEX-based collateral
            // Contract (lender for DEX loans) already holds the DEX collateral from loanIdToDexCollateralAmount[loanId].
        }
        emit LoanLiquidated(loanId, owner(), currentLoan.borrower);
    }

    function checkLoan(uint256 loanId) external onlyOwner nonReentrant { // [cite: 57]
        Loan storage currentLoan = loans[loanId];
        require(currentLoan.isActive && currentLoan.lender != address(0), "Loan not active or not funded to check");

        if (_isLoanDefaulted(loanId, currentLoan)) { // [cite: 58]
            _liquidateLoan(loanId, currentLoan);
        }
    }

    // --- Getter Functions ---
    function getBalance() public view onlyOwner returns (uint256) { // [cite: 48]
        return address(this).balance;
    }

    function getDexBalanceOfUser(address user) public view returns (uint256) { // [cite: 49]
        return balanceOf(user);
    }

    // This getter now returns the minimal Loan struct.
    // Frontend might need to make additional calls for DexCollateral, LenderStake, or calculated values.
    function getLoanDetails(uint256 loanId) external view returns (Loan memory) {
        return loans[loanId];
    }
    function getLoanDexCollateral(uint256 loanId) external view returns (uint256) {
        return loanIdToDexCollateralAmount[loanId];
    }
    function getLoanLenderDexStake(uint256 loanId) external view returns (uint256) {
        return loanIdToLenderDexStake[loanId];
    }


    function calculateCurrentPeriodicInterestPaymentForLoan(uint256 loanId) public view returns (uint256) {
        Loan storage currentLoan = loans[loanId];
        require(currentLoan.isActive && currentLoan.lender != address(0), "Cannot calculate for inactive/unfunded loan");
        return _getPeriodicInterestPayment(currentLoan);
    }

    // --- Owner Setter Functions ---
    function ownerSetDexSwapRate(uint256 _newDexToWeiRate) external onlyOwner { // For client-side req [cite: 61]
        require(_newDexToWeiRate > 0, "Rate must be > 0");
        uint256 oldRate = dexToWeiSwapRate;
        dexToWeiSwapRate = _newDexToWeiRate;
        emit DexSwapRateChanged(oldRate, _newDexToWeiRate);
    }

    function ownerSetGlobalLoanTerms(
        uint256 _newInterestBps,
        uint256 _newPeriodSeconds,
        uint256 _newTerminationFeeWei,
        uint256 _newMaxLoanDurationSeconds
    ) external onlyOwner {
        globalInterestRateBps = _newInterestBps;
        globalPeriodicitySeconds = _newPeriodSeconds;
        globalTerminationFeeWei = _newTerminationFeeWei;
        if (_newMaxLoanDurationSeconds > 0) {
            maxLoanDurationSeconds = _newMaxLoanDurationSeconds;
        }
    }

    // --- Internal Helper Functions ---
    function _updateDexSwapRate(bool ethIncreasedInContract, uint256 ethAmountUsedInTrade, uint256 dexAmountUsedInTrade) internal { //
        uint256 oldRate = dexToWeiSwapRate;
        if (ethIncreasedInContract) {
            dexToWeiSwapRate = dexToWeiSwapRate.mul(PERCENTAGE_SCALE + 10).div(PERCENTAGE_SCALE);
        } else {
            dexToWeiSwapRate = dexToWeiSwapRate.mul(PERCENTAGE_SCALE - 10).div(PERCENTAGE_SCALE);
        }
        if (dexToWeiSwapRate == 0) dexToWeiSwapRate = 1;
        if (oldRate != dexToWeiSwapRate) {
            emit DexSwapRateChanged(oldRate, dexToWeiSwapRate);
        }
        (ethAmountUsedInTrade, dexAmountUsedInTrade);
    }

    // --- Fallback and Receive ---
    receive() external payable {}
    fallback() external payable {}
}