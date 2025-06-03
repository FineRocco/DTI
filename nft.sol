// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";


contract SimpleNFT is ERC721URIStorage, Ownable, ERC721Enumerable {
    using Counters for Counters.Counter;
    Counters.Counter public tokenIdCounter; // Counter for generating unique token IDs

    uint256 public mintPrice = 1000 wei; // Price to mint one NFT

    /**
     * @dev Constructor sets the name, symbol for the NFT collection,
     * and transfers ownership to the deployer.
     */
    constructor() ERC721("Simple NFT", "SNFT") Ownable(msg.sender) {
        // The payable keyword was removed as the constructor doesn't need to receive Ether directly.
    }

    /**
     * @dev Mints a new NFT to the caller if the correct mintPrice is paid.
     * @param tokenURI The URI for the NFT's metadata.
     */
    function mint(string memory tokenURI) external payable {
        require(msg.value == mintPrice, "SimpleNFT: Incorrect WEI value sent for minting");

        tokenIdCounter.increment();
        uint256 newTokenId = tokenIdCounter.current();
        _safeMint(msg.sender, newTokenId);
        _setTokenURI(newTokenId, tokenURI);
    }

    /**
     * @dev Allows the owner to set a new minting price for NFTs.
     * @param _newPrice The new price in Wei.
     */
    function setMintPrice(uint256 _newPrice) external onlyOwner {
        mintPrice = _newPrice;
    }

    /**
     * @dev Returns the total number of NFTs minted so far.
     */
    function totalSupply() public view returns (uint256) {
        return tokenIdCounter.current();
    }

    /**
     * @dev Allows the owner to withdraw the Ether balance accumulated in this contract
     * (e.g., from minting fees).
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "SimpleNFT: No balance to withdraw");
        (bool success, ) = owner().call{value: balance}("");
        require(success, "SimpleNFT: Withdrawal failed");
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize)
    internal
    virtual
    override(ERC721, ERC721Enumerable) // Specify both base contracts
    {
    super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function supportsInterface(bytes4 interfaceId)
    public
    view
    virtual
    override(ERC721, ERC721Enumerable, ERC721URIStorage) // Specify all relevant inherited contracts
    returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev Overrides to make token URI and other functions like `ownerOf`, `approve` etc. visible.
     * ERC721URIStorage already provides `tokenURI`.
     * ERC721 provides `ownerOf`, `approve`, `transferFrom`, etc.
     * Ownable provides `owner`, `transferOwnership`.
     *
     * No further explicit overrides are strictly needed here unless you want to change
     * the base URI behavior or add other specific view functions beyond what OpenZeppelin provides.
     */

    // To make sure that the supportsInterface function needed by other contracts (like your DeFi contract)
    // correctly reports support for IERC721 and IERC721Metadata (which ERC721URIStorage does),
    // OpenZeppelin's ERC721 and ERC721URIStorage contracts already handle this.
    // You can explicitly override supportsInterface if you have other interfaces to support.
    // function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, ERC721URIStorage) returns (bool) {
    //     return super.supportsInterface(interfaceId);
    // }
}