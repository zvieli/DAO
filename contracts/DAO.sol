// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract DAO {
    struct Proposal {
        uint id;
        string title;
        string description;
        uint votesFor;
        uint votesAgainst;
        bool isOpen;
        uint createdAt;
        address creator;
    }

    Proposal[] public proposals;
    mapping(uint => mapping(address => bool)) public hasVoted;
    uint public nextProposalId = 1;

    event ProposalCreated(uint id, string title, address creator);
    event Voted(uint proposalId, address voter, bool support);
    event ProposalClosed(uint proposalId, uint votesFor, uint votesAgainst);

    modifier proposalExists(uint _proposalId) {
        require(_proposalId > 0 && _proposalId < nextProposalId, "Proposal does not exist");
        _;
    }

    modifier isOpen(uint _proposalId) {
        Proposal storage proposal = proposals[_proposalId - 1];
        require(proposal.isOpen, "Proposal is closed");
        _;
    }

    modifier notVoted(uint _proposalId) {
        require(!hasVoted[_proposalId][msg.sender], "Already voted");
        _;
    }

    modifier onlyCreator(uint _proposalId) {
        Proposal storage proposal = proposals[_proposalId - 1];
        require(msg.sender == proposal.creator, "Only creator can close proposal");
        _;
    }

    function createProposal(string memory _title, string memory _description) public {
        Proposal memory newProposal = Proposal({
            id: nextProposalId,
            title: _title,
            description: _description,
            votesFor: 0,
            votesAgainst: 0,
            isOpen: true,
            createdAt: block.timestamp,
            creator: msg.sender
        });

        proposals.push(newProposal);
        emit ProposalCreated(nextProposalId, _title, msg.sender);
        nextProposalId++;
    }

    function vote(uint _proposalId, bool _support)
        public
        proposalExists(_proposalId)
        isOpen(_proposalId)
        notVoted(_proposalId)
    {
        Proposal storage proposal = proposals[_proposalId - 1];

        if (_support) {
            proposal.votesFor++;
        } else {
            proposal.votesAgainst++;
        }

        hasVoted[_proposalId][msg.sender] = true;
        emit Voted(_proposalId, msg.sender, _support);
    }

    function closeProposal(uint _proposalId)
        public
        proposalExists(_proposalId)
        isOpen(_proposalId)
        onlyCreator(_proposalId)
    {
        Proposal storage proposal = proposals[_proposalId - 1];
        proposal.isOpen = false;
        emit ProposalClosed(_proposalId, proposal.votesFor, proposal.votesAgainst);
    }

    function getProposalsCount() public view returns (uint) {
        return proposals.length;
    }
}
