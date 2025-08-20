import { network } from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const { ethers } = await network.connect();

// תיקון __dirname בסביבת ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  // מקבלים חשבון לדיפלוי
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // יוצרים מופע של החוזה
  const DAOFactory = await ethers.getContractFactory("DAO");
  const dao = await DAOFactory.deploy();

  console.log("DAO deployed at:", dao.target);

  // שמירת כתובת החוזה ל־JSON
  const contractsDir = path.join(__dirname, "deployedContracts");
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  fs.writeFileSync(
    path.join(contractsDir, "DAO.json"),
    JSON.stringify({ address: dao.target }, null, 2)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});