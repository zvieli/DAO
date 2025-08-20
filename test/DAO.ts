import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();
import { Contract } from "ethers";

describe("DAO Contract", function () {
  let dao: any;
  let owner: any;
  let addr1: any;
  let addr2: any;

  beforeEach(async function () {
  [owner, addr1, addr2] = await ethers.getSigners();
  dao = await ethers.deployContract("DAO");
});


  it("should create a proposal", async function () {
    await dao.createProposal("Proposal 1", "Description 1");
    const count = await dao.getProposalsCount();
    expect(count).to.equal(1);
  });

  it("should allow voting and prevent double voting", async function () {
    await dao.createProposal("Proposal 1", "Description 1");

    await dao.connect(addr1).vote(1, true);

    // בדיקה שמונעת הצבעה כפולה
    await expect(dao.connect(addr1).vote(1, false)).to.be.revertedWith(
      "Already voted"
    );
  });

  it("should only allow creator to close proposal", async function () {
    await dao.createProposal("Proposal 1", "Description 1");

    // ניסיון של מישהו שלא היוצר לסגור – צריך להיכשל
    await expect(dao.connect(addr1).closeProposal(1)).to.be.revertedWith(
      "Only creator can close proposal"
    );

    // היוצר סוגר את ההצעה בהצלחה
    await dao.closeProposal(1);
    const proposal = await dao.proposals(0);
    expect(proposal.isOpen).to.be.false;
  });
});