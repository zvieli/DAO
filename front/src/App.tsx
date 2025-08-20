// src/App.tsx
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import DAOJson from "../artifacts/contracts/DAO.sol/DAO.json";

declare global {
  interface Window {
    ethereum?: any;
  }
}

function App() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [daoContract, setDaoContract] = useState<ethers.Contract | null>(null);
  const [userAddress, setUserAddress] = useState<string>("");

  useEffect(() => {
    const init = async () => {
      if (window.ethereum) {
        const browserProvider = new ethers.BrowserProvider(window.ethereum);
        setProvider(browserProvider);

        const signer = await browserProvider.getSigner();
        setSigner(signer);

        const address = await signer.getAddress();
        setUserAddress(address);

        const dao = new ethers.Contract(
          "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", // כתובת החוזה מהדיפלוי
          DAOJson.abi,
          signer
        );
        setDaoContract(dao);
      } else {
        alert("אנא התקן MetaMask!");
      }
    };

    init();
  }, []);

  return (
    <div style={{ padding: "2rem" }}>
      <h1>DAO Frontend</h1>
      {userAddress && <p>מחובר עם כתובת: {userAddress}</p>}
      {daoContract && <p>חוזה מחובר בכתובת: {String(daoContract.target)}</p>}
    </div>
  );
}

export default App;
