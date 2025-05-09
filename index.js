const express = require("express");
const { ethers } = require("ethers");
const contractAbi = require("./abi.json");
require("dotenv").config();
const crypto = require("crypto");
const abi = contractAbi.abi;
const app = express();
app.use(express.json());
console.log(process.env.AMOY_RPC_URL);

const provider = new ethers.JsonRpcProvider(process.env.AMOY_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contractAddress = "0x0a96f7aE5853Cc38De7c11913F3083D1D37aa7A7";
const contract = new ethers.Contract(contractAddress, abi, wallet);

// Hash UID
function hashUid(uid) {
  const secretUid = process.env.SECRET_PHRASE + uid;
  return crypto.createHash("sha256").update(secretUid).digest("hex");
}

// POST /vote
app.post("/vote", async (req, res) => {
  const { electionId, uid, candidate } = req.body;
  console.log(electionId);

  try {
    const hashedUid = hashUid(uid);
    const tx = await contract.vote(electionId, hashedUid, candidate);
    await tx.wait();
    const receipt = await tx.wait();

    console.log("Transaction hash:", tx.hash); // Log the transaction hash
    console.log("Transaction status:", receipt.status); // Log the transaction status

    // Determine success or fail based on the status
    const txStatus = receipt.status === 1 ? "success" : "fail";

    res.send({
      message: "Vote cast successfully",
      txHash: tx.hash, // Transaction hash
      txStatus: txStatus, // "success" if status is 1, "fail" if status is 0
    });
  } catch (err) {
    console.error("Error casting vote:", err);

    if (err.message.includes("Already voted in this election")) {
      res
        .status(400)
        .send({ error: "You have already voted in this election." });
    } else {
      res.status(500).send({ error: err.message });
    }
  }
});

// GET /votes/all?electionId=election2025

app.get("/votes/all", async (req, res) => {
  const { electionId } = req.query;

  if (!electionId) {
    return res.status(400).send({ error: "Missing electionId in query" });
  }

  try {
    const allElections = await contract.getAllElections();
    console.log(allElections);

    // Check if electionId exists
    const exists = allElections.includes(electionId);
    if (!exists) {
      return res.status(404).send({ error: "Election ID does not exist" });
    }

    const [candidates, counts] = await contract.getAllVoteCounts(electionId);

    const results = candidates.map((candidate, index) => ({
      candidate,
      votes: counts[index].toString(),
    }));

    res.send({ electionId, results });
  } catch (err) {
    console.error("Error fetching all vote counts:", err);
    res.status(500).send({ error: err.reason || err.message });
  }
});

app.get("/votes", async (req, res) => {
  const { electionId, candidate } = req.query;

  if (!electionId || !candidate) {
    return res
      .status(400)
      .send({ error: "Both electionId and candidate are required" });
  }

  try {
    const votes = await contract.getVoteCount(electionId, candidate);
    res.send({ candidate, votes: votes.toString() });
  } catch (err) {
    console.error("Error fetching vote count:", err);
    res.status(500).send({ error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`),
);
