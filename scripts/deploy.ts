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
  await dao.waitForDeployment();

  console.log("DAO deployed at:", dao.target);

  // מיקום הקובץ לפרונט
  const contractsDir = path.join(__dirname, "../front/src/contracts");
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  // JSON עם כתובת + ABI
  const daoJson = {
    address: dao.target,
    abi: JSON.parse(DAOFactory.interface.formatJson())
  };

  fs.writeFileSync(
    path.join(contractsDir, "DAO.json"),
    JSON.stringify(daoJson, null, 2)
  );

  console.log("Contract ABI + address saved to front/src/contracts/DAO.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});