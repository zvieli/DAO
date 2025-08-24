declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
    };
  }
}

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import DAOJson from "./contracts/DAO.json";
import "./App.css";

interface Proposal {
  id: number;
  title: string;
  description: string;
  votesFor: number;
  votesAgainst: number;
  isOpen: boolean;
  createdAt: number;
  creator: string;
  hasVoted?: boolean;
}

function App() {
  const [dao, setDao] = useState<ethers.Contract | null>(null);
  const [account, setAccount] = useState<string>("");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeTab, setActiveTab] = useState<"proposals" | "create">("proposals");
  const [toasts, setToasts] = useState<{id: number; message: string; type: 'success' | 'error' | 'info'}[]>([]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const requestAccountAccess = async (forceNewPermission = false) => {
    if (!window.ethereum) {
      alert("Please install MetaMask!");
      return null;
    }

    try {
      setIsConnecting(true);
      let accounts;
      
      if (forceNewPermission) {
        try {
          await window.ethereum.request({
            method: 'wallet_requestPermissions',
            params: [{ eth_accounts: {} }]
          });
        } catch (permError: any) {
          if (permError.code === -32002) {
            console.log("Permission request already pending");
          } else {
            throw permError;
          }
        }
      }

      accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });

      if (accounts.length === 0) {
        throw new Error("No accounts available");
      }

      const _provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await _provider.getSigner();
      const selectedAccount = await signer.getAddress();

      return { provider: _provider, signer, account: selectedAccount };
    } catch (error: any) {
      console.error("Error accessing MetaMask:", error);
      if (error.code === -32002 && provider) {
        try {
          const signer = await provider.getSigner();
          const currentAccount = await signer.getAddress();
          return { provider, signer, account: currentAccount };
        } catch {
          return null;
        }
      }
      return null;
    } finally {
      setIsConnecting(false);
    }
  };

  const connectOrSwitchWallet = async (forceSwitch: boolean = false) => {
    const result = await requestAccountAccess(forceSwitch);
    if (result) {
      setProvider(result.provider);
      setAccount(result.account);
      const daoContract = new ethers.Contract(DAOJson.address, DAOJson.abi, result.signer);
      setDao(daoContract);
      addToast('Wallet connected successfully!', 'success');
    }
  };

  const executeWithCurrentAccount = async (action: (signer: ethers.Signer) => Promise<any>) => {
    if (!provider || !account) {
      await connectOrSwitchWallet();
      return;
    }

    try {
      setIsConnecting(true);
      const signer = await provider.getSigner();
      const currentAccount = await signer.getAddress();
      
      if (currentAccount !== account) {
        setAccount(currentAccount);
        const daoContract = new ethers.Contract(DAOJson.address, DAOJson.abi, signer);
        setDao(daoContract);
      }

      await action(signer);
    } catch (error) {
      console.error("Error executing action:", error);
      if (error instanceof Error) {
        addToast(`Error: ${error.message}`, 'error');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const fetchProposals = async () => {
    if (!dao || !account) return;
    try {
      const count = await dao.getProposalsCount();
      const arr: Proposal[] = [];
      
      for (let i = 0; i < Number(count); i++) {
        const p = await dao.proposals(i);
        const hasVoted = await dao.hasVoted(p.id, account);
        
        arr.push({
          id: Number(p.id),
          title: p.title,
          description: p.description,
          votesFor: Number(p.votesFor),
          votesAgainst: Number(p.votesAgainst),
          isOpen: p.isOpen,
          createdAt: Number(p.createdAt),
          creator: p.creator,
          hasVoted: hasVoted
        });
      }
      
      setProposals(arr.sort((a, b) => b.id - a.id));
    } catch (error) {
      console.error("Error fetching proposals:", error);
      addToast('Error fetching proposals', 'error');
    }
  };

  const createProposal = async () => {
    if (!newTitle || !newDescription) {
      addToast('Please fill both title and description!', 'error');
      return;
    }

    await executeWithCurrentAccount(async (signer) => {
      try {
        const daoContract = new ethers.Contract(DAOJson.address, DAOJson.abi, signer);
        addToast('Creating proposal...', 'info');
        const tx = await daoContract.createProposal(newTitle, newDescription);
        await tx.wait();
        addToast('Proposal created successfully!', 'success');
        setNewTitle("");
        setNewDescription("");
        setActiveTab("proposals");
        fetchProposals();
      } catch (error: any) {
        console.error("Error creating proposal:", error);
        addToast(`Error: ${error.reason || error.message}`, 'error');
      }
    });
  };

  const voteProposal = async (id: number, support: boolean) => {
    await executeWithCurrentAccount(async (signer) => {
      try {
        const daoContract = new ethers.Contract(DAOJson.address, DAOJson.abi, signer);
        addToast('Submitting vote...', 'info');
        const tx = await daoContract.vote(id, support);
        await tx.wait();
        addToast(`Voted ${support ? 'FOR' : 'AGAINST'} proposal!`, 'success');
        fetchProposals();
      } catch (error: any) {
        console.error("Error voting:", error);
        addToast(`Error: ${error.reason || error.message}`, 'error');
      }
    });
  };

  const closeProposal = async (id: number) => {
    await executeWithCurrentAccount(async (signer) => {
      try {
        const daoContract = new ethers.Contract(DAOJson.address, DAOJson.abi, signer);
        addToast('Closing proposal...', 'info');
        const tx = await daoContract.closeProposal(id);
        await tx.wait();
        addToast('Proposal closed successfully!', 'success');
        fetchProposals();
      } catch (error: any) {
        console.error("Error closing proposal:", error);
        addToast(`Error: ${error.reason || error.message}`, 'error');
      }
    });
  };

  const disconnectWallet = () => {
    setAccount("");
    setDao(null);
    setProvider(null);
    setProposals([]);
    addToast('Wallet disconnected', 'info');
  };

  useEffect(() => {
    const ethereum = window.ethereum;
    if (!ethereum) return;

    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length === 0) {
        setAccount("");
        setDao(null);
        setProvider(null);
        setProposals([]);
        addToast('Wallet disconnected', 'info');
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);

    return () => {
      if (ethereum.removeListener) {
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
        ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  useEffect(() => {
    if (dao && account) {
      fetchProposals();
      
      // Event listeners
      dao.on("ProposalCreated", (id, title, creator) => {
        console.log("New proposal created:", id.toString());
        addToast(`New proposal: ${title}`, 'info');
        fetchProposals();
      });

      dao.on("Voted", (proposalId, voter, support) => {
        console.log("Vote cast:", proposalId.toString(), voter, support);
        if (voter.toLowerCase() === account.toLowerCase()) {
          addToast(`You voted ${support ? 'FOR' : 'AGAINST'} proposal #${proposalId}`, 'success');
        }
        fetchProposals();
      });

      dao.on("ProposalClosed", (proposalId, votesFor, votesAgainst) => {
        console.log("Proposal closed:", proposalId.toString());
        addToast(`Proposal #${proposalId} closed! Results: ${votesFor} FOR, ${votesAgainst} AGAINST`, 'info');
        fetchProposals();
      });
    }

    return () => {
      if (dao) {
        dao.removeAllListeners();
      }
    };
  }, [dao, account]);

  const ToastComponent = () => (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span>{toast.message}</span>
          <button className="toast-close" onClick={() => removeToast(toast.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );

  return (
  
  <div className="app-container">
    <header className="header">
      <div className="header-content">
        <a href="#" className="logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span className="logo-text">DAO Governance</span>
        </a>
        
        {account ? (
          <div className="header-account-section">
            <div className="account-badge">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <span className="account-address">
                {account.substring(0, 6)}...{account.substring(account.length - 4)}
              </span>
            </div>
            
            <button 
              className="btn btn-secondary"
              onClick={() => connectOrSwitchWallet(true)}
              disabled={isConnecting}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M17 3l5 5-5 5"/>
                <path d="M22 8h-6a5 5 0 0 0-5 5v1"/>
                <path d="M7 21l-5-5 5-5"/>
                <path d="M2 16h6a5 5 0 0 0 5-5v-1"/>
              </svg>
              Switch
            </button>
            
            <button 
              className="btn btn-danger"
              onClick={disconnectWallet}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Disconnect
            </button>
          </div>
        ) : (
          <button 
            className="btn btn-primary"
            onClick={() => connectOrSwitchWallet()}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <div className="spinner small-spinner"></div>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            )}
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </div>
    </header>

    <main className="main-content">
      {!account ? (
        <div className="hero-section">
          <h1 className="hero-title">Decentralized Autonomous Organization</h1>
          <p className="hero-subtitle">
            Participate in community governance by creating proposals and voting on important decisions. 
            Connect your wallet to get started with decentralized democracy.
          </p>
          
          <button 
            className="btn btn-primary btn-large"
            onClick={() => connectOrSwitchWallet()}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <div className="spinner medium-spinner"></div>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            )}
            {isConnecting ? "Connecting..." : "Get Started"}
          </button>
          
          <div className="feature-grid">
            {[
              { icon: "➕", title: "Create Proposals", desc: "Submit new ideas for community voting" },
              { icon: "👍", title: "Vote Securely", desc: "Cast your votes on the blockchain" },
              { icon: "🏆", title: "Earn Influence", desc: "Build reputation through participation" }
            ].map((item, index) => (
              <div key={index} className="feature-card">
                <div className="feature-icon">{item.icon}</div>
                <h3 className="feature-title">{item.title}</h3>
                <p className="feature-desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="tab-container">
            <div className="tab-header">
              <button 
                className={`tab-button ${activeTab === "proposals" ? "active" : ""}`}
                onClick={() => setActiveTab("proposals")}
              >
                Proposals ({proposals.length})
              </button>
              <button 
                className={`tab-button ${activeTab === "create" ? "active" : ""}`}
                onClick={() => setActiveTab("create")}
              >
                Create Proposal
              </button>
            </div>
            
            {activeTab === "create" && (
              <div className="form-container">
                <h2 className="form-title">Create New Proposal</h2>
                
                <input
                  placeholder="Proposal Title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="form-input"
                />

                <textarea
                  placeholder="Describe your proposal in detail..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="form-textarea"
                />

                <button 
                  className="btn btn-primary"
                  onClick={createProposal}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <div className="spinner small-spinner"></div>
                  ) : (
                    <span className="plus-icon">+</span>
                  )}
                  {isConnecting ? "Creating..." : "Create Proposal"}
                </button>
              </div>
            )}
          </div>

          {activeTab === "proposals" && (
            <>
              <div className="proposals-grid">
                {proposals.map((proposal) => (
                  <div key={proposal.id} className="proposal-card">
                    <div className={`proposal-status-bar ${proposal.isOpen ? "active" : "closed"}`}></div>
                    
                    <div className="proposal-content">
                      <div className="proposal-header">
                        <h3 className="proposal-title">#{proposal.id}: {proposal.title}</h3>
                        <span className={`status-badge ${proposal.isOpen ? "active" : "closed"}`}>
                          {proposal.isOpen ? 'ACTIVE' : 'CLOSED'}
                        </span>
                      </div>
                      
                      <p className="proposal-description">{proposal.description}</p>
                      
                      <div className="stats-container">
                        <div className="stats-grid">
                          <div className="stat-item">
                            <div className="stat-value for">{proposal.votesFor}</div>
                            <div className="stat-label">Votes For</div>
                          </div>
                          <div className="stat-item">
                            <div className="stat-value against">{proposal.votesAgainst}</div>
                            <div className="stat-label">Votes Against</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="proposal-meta">
                        <div className="proposal-date">
                          <span>📅</span>
                          <span>{new Date(proposal.createdAt * 1000).toLocaleDateString()}</span>
                        </div>
                        <span className="proposal-creator">By {proposal.creator.substring(0, 8)}...{proposal.creator.substring(proposal.creator.length - 4)}</span>
                      </div>
                      
                      {proposal.isOpen && !proposal.hasVoted && (
                        <div className="vote-buttons">
                          <button
                            className="vote-button vote-for"
                            onClick={() => voteProposal(proposal.id, true)}
                            disabled={isConnecting}
                          >
                            <span>👍</span>
                            <span>Vote For</span>
                          </button>
                          <button
                            className="vote-button vote-against"
                            onClick={() => voteProposal(proposal.id, false)}
                            disabled={isConnecting}
                          >
                            <span>👎</span>
                            <span>Vote Against</span>
                          </button>
                        </div>
                      )}
                      
                      {proposal.isOpen && proposal.hasVoted && (
                        <div className="already-voted">
                          ✅ You already voted on this proposal
                        </div>
                      )}
                      
                      {proposal.isOpen && proposal.creator.toLowerCase() === account.toLowerCase() && (
                        <button
                          className="btn btn-warning"
                          onClick={() => closeProposal(proposal.id)}
                          disabled={isConnecting}
                        >
                          🚫 Close Proposal
                        </button>
                      )}
                      
                      {!proposal.isOpen && (
                        <div className="results-final">
                          🏁 Voting closed • {proposal.votesFor > proposal.votesAgainst ? 'PASSED' : 'REJECTED'}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {proposals.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <span>🏆</span>
                  </div>
                  <h3 className="empty-state-title">No Proposals Yet</h3>
                  <p className="empty-state-desc">Be the first to create a proposal and start the governance process!</p>
                  <button 
                    className="btn btn-primary"
                    onClick={() => setActiveTab("create")}
                  >
                    <span className="plus-icon">+</span>
                    Create First Proposal
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </main>

    <footer className="footer">
      <div className="footer-content">
        <p>Powered by Ethereum & Hardhat • Built with React & TypeScript</p>
      </div>
    </footer>

    <ToastComponent />
  </div>
);
}

export default App;