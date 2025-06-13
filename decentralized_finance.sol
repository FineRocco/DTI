// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract DecentralizedFinance is ERC20 {
    address public owner;

    struct Loan {
        uint256 deadline;
        uint256 amount;
        address lender;
        address borrower;
        bool isBasedNft;
        IERC721 nftContract;
        uint256 nftId;
        bool isActive;
        uint256 nrLeftPayments; 
        uint256 nextPaymentDeadline; 
    }

    uint256 public periodicity; // e.g., 3 minutes
    uint256 public interest; // e.g., 10 means 10%
    uint256 public termination;
    uint256 public maxLoanDuration = 30 days;
    uint256 public dexSwapRate; // Wei per DEX
    uint256 public balance;

    mapping(uint256 => Loan) public loans;
    uint256 public loanCounter;

    event loanCreated(uint256 loanId, address borrower, uint256 amount, uint256 deadline);
    event LoanChecked(uint256 loanId, address borrower, bool isActive, bool wasPunished);
    event nftLoanRequestCreated(address sender, uint256 nftId, uint256 loanAmount, uint256 deadline);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(uint256 rate, uint256 _periodicity, uint256 _interest, uint256 _termination) ERC20("DEX", "DEX") {
        _mint(address(this), 10**18);
        owner = msg.sender;
        dexSwapRate = rate;
        periodicity = _periodicity; // em segundos
        interest = _interest; // em percentagem
        termination = _termination; // em percentagem
    }

    function buyDex() external payable {
        require(msg.value > 0, "Send ETH to buy DEX");
        require(msg.value >= dexSwapRate, "Not enough Wei to buy 1 DEX");

        uint256 dexAmount = msg.value / dexSwapRate;
        uint256 cost = dexAmount * dexSwapRate;
        uint256 refund = msg.value - cost;

        require(balanceOf(address(this)) >= dexAmount, "Not enough DEX available");
        
        _transfer(address(this), msg.sender, dexAmount);
        balance += cost;

        if (refund > 0) {
            payable(msg.sender).transfer(refund);
        }
    }


    function sellDex(uint256 dexAmount) external {
        uint256 ethValue = dexAmount * dexSwapRate;
        require(address(this).balance >= ethValue, "Not enough ETH in contract");
        _transfer(msg.sender, address(this), dexAmount);
        payable(msg.sender).transfer(ethValue);
        balance -= ethValue; // update contract ETH balance
    }

    function loan(uint256 dexAmount, uint256 deadline) external returns (uint256) {
        require(deadline <= block.timestamp + maxLoanDuration, "Deadline too far");
        require(balanceOf(msg.sender) >= dexAmount, "Not enough DEX");

        uint256 loanValue = dexAmount * dexSwapRate;
        _transfer(msg.sender, address(this), dexAmount);

        uint256 loanDuration = deadline - block.timestamp;

        // Número total de pagamentos (divisão inteira)
        uint256 totalPayments = (loanDuration + periodicity - 1) / periodicity;

        loans[++loanCounter] = Loan({
            deadline: deadline,
            amount: loanValue,
            lender: address(this),
            borrower: msg.sender,
            isBasedNft: false,
            nftContract: IERC721(address(0)),
            nftId: 0,
            isActive: true,
            nrLeftPayments: totalPayments,
            nextPaymentDeadline: block.timestamp + periodicity
        });

        require(balance >= loanValue, "Not enough balance");
        payable(msg.sender).transfer(loanValue);
        balance -= loanValue;

        emit loanCreated(loanCounter, msg.sender, loanValue, deadline);
        return loanCounter;
    }

    function makePayment(uint256 loanId) external payable {
        require(loanId > 0 && loanId <= loanCounter, "No loan with the given Id");
        Loan storage ln = loans[loanId];

        require(ln.isActive, "Inactive loan");
        require(msg.sender == ln.borrower, "Not borrower");

        require(ln.nextPaymentDeadline - periodicity < block.timestamp, "Payment too soon");

        require(block.timestamp < ln.nextPaymentDeadline, "Failed the next payment deadline");
            
        uint256 durationInYears = periodicity * 1e18 / 365 days; // scale for precision
        uint256 interestDue = (ln.amount * interest * durationInYears) / 1e20;

        require(msg.value >= interestDue, "Insufficient interest payment");

        uint256 totalDue = interestDue;

        // Atualiza número de pagamentos restantes
        if (ln.nrLeftPayments == 1) {
            totalDue += ln.amount;// Add principal on final payment
            require(msg.value >= totalDue, "Final payment must include loan amount");

            uint256 dexReturn = ln.amount / dexSwapRate;

            if(!ln.isBasedNft){
                _transfer(address(this), msg.sender, dexReturn);
            }
            else{
                _transfer(address(this), ln.lender, dexReturn);
                IERC721(ln.nftContract).transferFrom(address(this), ln.borrower, ln.nftId);
            }

            balance += totalDue;
            ln.nrLeftPayments = 0;
            ln.isActive = false; // empréstimo pode ser considerado quitado ou finalizado
        } else {
            ln.nrLeftPayments -= 1;
            balance += totalDue;
            ln.nextPaymentDeadline += periodicity; 
        }

        // Refund excess
        uint256 excess = msg.value - totalDue;
        if (excess > 0) {
            payable(msg.sender).transfer(excess);
        }
        
    }


    function terminateLoan(uint256 loanId) external payable {
        require(loanId > 0 && loanId <= loanCounter, "No loan with the given Id");
        Loan storage ln = loans[loanId];

        require(ln.isActive, "Inactive loan");
        require(!ln.isBasedNft, "Can't terminate NFT loan");
        require(msg.sender == ln.borrower, "Not borrower");

        require(block.timestamp < ln.deadline, "Deadline expired");

        uint256 fee = (ln.amount * termination) / 100;
        uint256 totalOwed = ln.amount + fee;

        require(msg.value >= totalOwed, "Insufficient repayment");

        balance += totalOwed;

        uint256 dexReturn = ln.amount / dexSwapRate;
        _transfer(address(this), msg.sender, dexReturn);

        ln.isActive = false;

        // Refund any excess ETH sent
        uint256 excess = msg.value - totalOwed;
        if (excess > 0) {
            payable(msg.sender).transfer(excess);
        }
    }

    function getBalance() public view onlyOwner returns (uint256) {
        return address(this).balance;
    }

    function getDexBalance() public view returns (uint256) {
        return balanceOf(msg.sender);
    }

    function makeLoanRequestByNft(IERC721 nftContract, uint256 nftId, uint256 loanAmount, uint256 deadline) external {
        require(deadline <= block.timestamp + maxLoanDuration, "Deadline too far");
        require(nftContract.ownerOf(nftId) == msg.sender, "You don't own the NFT");

        uint256 loanDuration = deadline - block.timestamp;

        // Número total de pagamentos (divisão inteira)
        uint256 totalPayments = (loanDuration + periodicity - 1) / periodicity;

        loans[++loanCounter] = Loan({
            deadline: deadline,
            amount: loanAmount,
            lender: address(0),
            borrower: msg.sender,
            isBasedNft: true,
            nftContract: nftContract,
            nftId: nftId,
            isActive: true,
            nrLeftPayments: totalPayments,
            nextPaymentDeadline: block.timestamp + periodicity
        });

        emit nftLoanRequestCreated(msg.sender, nftId, loanAmount, deadline);
    }

    function cancelLoanRequestByNft(IERC721 nftContract, uint256 nftId) external {
        for (uint256 i = 1; i <= loanCounter; i++) {
            Loan storage ln = loans[i];
            if (
                ln.isActive &&
                ln.isBasedNft &&
                ln.nftContract == nftContract &&
                ln.nftId == nftId &&
                ln.borrower == msg.sender &&
                ln.lender == address(0)
            ) {
                ln.isActive = false;
                return;
            }
        }
        revert("No matching NFT loan request");
    }

    function loanByNft(IERC721 nftContract, uint256 nftId) external {
        for (uint256 i = 1; i <= loanCounter; i++) {
            Loan storage ln = loans[i];
            if (
                ln.isActive &&
                ln.isBasedNft &&
                ln.nftContract == nftContract &&
                ln.nftId == nftId &&
                ln.lender == address(0) &&
                block.timestamp < ln.deadline
            ) {
                ln.lender = msg.sender;

                uint256 dexToStake = ln.amount / dexSwapRate;
                require(balanceOf(ln.lender) >= dexToStake, "Not enough DEX");

                _transfer(ln.lender, address(this), dexToStake);
                
                nftContract.transferFrom(ln.borrower, address(this), nftId);

                payable(ln.borrower).transfer(ln.amount);
                balance -= ln.amount;
                
                emit loanCreated(i, ln.borrower, ln.amount, ln.deadline);
                return;
                
            }
        }
        revert("No matching loan request");
    }


    function checkLoan(uint256 loanId) external onlyOwner {
        Loan storage ln = loans[loanId];
        require(ln.isActive, "Loan is not active");

        bool punished = false;

        // If deadline passed and loan not yet repaid
        if (block.timestamp > ln.deadline && ln.lender != address(0)) {
            ln.isActive = false;
            punished = true;

            if (ln.isBasedNft) {
                // Transfer NFT to lender as penalty
                IERC721(ln.nftContract).transferFrom(address(this), ln.lender, ln.nftId);
            }
        }

        emit LoanChecked(loanId, ln.borrower, ln.isActive, punished);
    }


    function ownerSetDexSwapRate(uint256 newRate) external onlyOwner {
        require(newRate > 0, "Rate must be > 0");
        dexSwapRate = newRate;
    }

}
