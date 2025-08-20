declare global {
  interface Window {
    ethereum?: any;
  }
}

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import DAOJson from "./contracts/DAO.json";

interface Proposal {
  id: number;
  title: string;
  description: string;
  votesFor: number;
  votesAgainst: number;
  isOpen: boolean;
  createdAt: number;
  creator: string;
}

function App() {
  const [dao, setDao] = useState<ethers.Contract | null>(null);
  const [account, setAccount] = useState<string>("");
  const [proposals, setProposals] = useState<Proposal[]>([]);

  const connectWallet = async () => {
    if (!window.ethereum) return alert("Install MetaMask!");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const _account = await signer.getAddress();
    setAccount(_account);

    const daoContract = new ethers.Contract(DAOJson.address, DAOJson.abi, signer);
    setDao(daoContract);
  };

  const fetchProposals = async () => {
    if (!dao) return;
    const count = await dao.getProposalsCount();
    const arr: Proposal[] = [];
    for (let i = 1; i <= Number(count); i++) {
      const p = await dao.proposals(i - 1);
      arr.push({
        id: Number(p.id),
        title: p.title,
        description: p.description,
        votesFor: Number(p.votesFor),
        votesAgainst: Number(p.votesAgainst),
        isOpen: p.isOpen,
        createdAt: Number(p.createdAt),
        creator: p.creator,
      });
    }
    setProposals(arr);
  };

  useEffect(() => {
    if (dao) fetchProposals();
  }, [dao]);

  return (
    <div>
      {!account ? <button onClick={connectWallet}>Connect Wallet</button> : <div>Connected: {account}</div>}
      <h1>Proposals</h1>
      {proposals.map((p) => (
        <div key={p.id}>
          <h3>{p.title}</h3>
          <p>{p.description}</p>
          <p>Votes For: {p.votesFor} | Votes Against: {p.votesAgainst}</p>
          <p>Status: {p.isOpen ? "Open" : "Closed"}</p>
        </div>
      ))}
    </div>
  );
}

export default App;
