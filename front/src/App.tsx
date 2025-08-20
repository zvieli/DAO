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

  // קבלת גישה למטאמאסק
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

  // חיבור/החלפת חשבון
  const connectOrSwitchWallet = async (forceSwitch: boolean = false) => {
    const result = await requestAccountAccess(forceSwitch);
    if (result) {
      setProvider(result.provider);
      setAccount(result.account);
      const daoContract = new ethers.Contract(DAOJson.address, DAOJson.abi, result.signer);
      setDao(daoContract);
    }
  };

  // ביצוע פעולה
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
        alert(`Error: ${error.message}`);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // קבלת הצעות
  const fetchProposals = async () => {
    if (!dao) return;
    try {
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
    } catch (error) {
      console.error("Error fetching proposals:", error);
    }
  };

  // יצירת הצעה
  const createProposal = async () => {
    if (!newTitle || !newDescription) {
      alert("Please fill both title and description!");
      return;
    }

    await executeWithCurrentAccount(async (signer) => {
      const daoContract = new ethers.Contract(DAOJson.address, DAOJson.abi, signer);
      const tx = await daoContract.createProposal(newTitle, newDescription);
      await tx.wait();
      setNewTitle("");
      setNewDescription("");
      setActiveTab("proposals");
      fetchProposals();
    });
  };

  // הצבעה
  const voteProposal = async (id: number, support: boolean) => {
    await executeWithCurrentAccount(async (signer) => {
      const daoContract = new ethers.Contract(DAOJson.address, DAOJson.abi, signer);
      const tx = await daoContract.vote(id, support);
      await tx.wait();
      fetchProposals();
    });
  };

  // ניתוק
  const disconnectWallet = () => {
    setAccount("");
    setDao(null);
    setProvider(null);
    setProposals([]);
  };

  // אפקטים
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = async (accounts: string[]) => {
        if (accounts.length === 0) disconnectWallet();
      };
      const handleChainChanged = () => window.location.reload();

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, []);

  useEffect(() => {
    if (dao) fetchProposals();
  }, [dao]);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <a href="#" className="logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span className="logo-text">DAO Governance</span>
          </a>
          
          {account ? (
            <div className="flex items-center gap-3">
              <div className="account-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <span>{account.substring(0, 6)}...{account.substring(account.length - 4)}</span>
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
                <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
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

      {/* Main Content */}
      <main className="main-content">
        {!account ? (
          // Hero Section
          <div className="hero-section">
            <h1 className="hero-title">Decentralized Autonomous Organization</h1>
            <p className="hero-subtitle">
              Participate in community governance by creating proposals and voting on important decisions. 
              Connect your wallet to get started with decentralized democracy.
            </p>
            
            <button 
              className="btn btn-primary"
              onClick={() => connectOrSwitchWallet()}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <div className="spinner" style={{ width: '18px', height: '18px' }}></div>
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
                  <div className="feature-icon" style={{ fontSize: '24px' }}>{item.icon}</div>
                  <h3 className="feature-title">{item.title}</h3>
                  <p className="feature-desc">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Connected State
          <>
            {/* Tabs */}
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
              
              {/* Create Proposal Form */}
              {activeTab === "create" && (
                <div className="form-container">
                  <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '1.5rem', color: '#1e293b' }}>
                    Create New Proposal
                  </h2>
                  
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
                      <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
                    ) : (
                      <span style={{ fontSize: '18px' }}>+</span>
                    )}
                    {isConnecting ? "Creating..." : "Create Proposal"}
                  </button>
                </div>
              )}
            </div>

            {/* Proposals Grid */}
            {activeTab === "proposals" && (
              <>
                <div className="proposals-grid">
                  {proposals.map((proposal) => (
                    <div key={proposal.id} className="proposal-card">
                      <div className={`proposal-status-bar ${proposal.isOpen ? "active" : "closed"}`}></div>
                      
                      <div className="proposal-content">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
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
                        
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '13px', color: '#94a3b8' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>📅</span>
                            <span>{new Date(proposal.createdAt * 1000).toLocaleDateString()}</span>
                          </div>
                          <span>By {proposal.creator.substring(0, 8)}...{proposal.creator.substring(proposal.creator.length - 4)}</span>
                        </div>
                        
                        {proposal.isOpen && (
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
                      </div>
                    </div>
                  ))}
                </div>

                {/* Empty State */}
                {proposals.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <span style={{ fontSize: '48px' }}>🏆</span>
                    </div>
                    <h3 className="empty-state-title">No Proposals Yet</h3>
                    <p className="empty-state-desc">Be the first to create a proposal and start the governance process!</p>
                    <button 
                      className="btn btn-primary"
                      onClick={() => setActiveTab("create")}
                    >
                      <span style={{ fontSize: '18px' }}>+</span>
                      Create First Proposal
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <p>Powered by Ethereum & Hardhat • Built with React & TypeScript</p>
        </div>
      </footer>
    </div>
  );
}

export default App;