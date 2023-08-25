# Algorand xGov
>Decentralized governance running on Algorand.

![Static Badge](https://img.shields.io/badge/xGovs-4765-blue)
![Static Badge](https://img.shields.io/badge/Application-1158913461-yellow)
![Static Badge](https://img.shields.io/badge/Session-1-green)
![Static Badge](https://img.shields.io/badge/Questions-27-cyan)


<p align="center">
  <img width="500" height="300" src="./assets/xgov.png">
</p>

 <p align="center" style="font-size: x-large">
    Get Started:
    <a href="https://xgov.algorand.foundation">xGov</a> |
    <a href="./packages/xgov-goal/README.md">Goal</a> |
    <a href="">Kit</a> |
    <a>SDK</a>
  </p>

## Overview 

Prior to a voting round starting, an administrator will collect questions from the community. Once the questions are 
finalized, a snapshot of elegable governors is taken. During the creation of the voting round application, the 
governors snapshot and finalized questions are uploaded to IPFS. 

Every Voting Round Application has a `metadata_ipfs_cid` Global State key, it's value is the unique id of the finalized
questions in IPFS. The questions metadata includes the `voteGatingSnapshotCid` key, which is the unique id of the finalized
snapshot in IPFS.

There are several ways to interact with the contract, the following guides are available:

