# Overview

Guide to interacting the the smart contract.  Requires an admin to have created at least one Voting Round with funding.
See [Admin Guide](./ADMIN.md) for more details

Global Resources:

- Application Specification [(from the `xgov-contract`)][application.json]
- Application Wallet Address [(mainnet is `C3DQJVL6ZVGL6MZ6JBDBEKYEXRV5NCPZYJUJ3BLRDK6V7ETKYC6NO6HOPA`)][wallet]

## Step 1

Collect necessary information to submit a vote.

- Application ID [(current mainnet voting round is `1158913461`)][application]
- Global State
- IPFS Metadata [(from the `xgov-api` using global state key `metadata_ipfs_cid`)][ipfs]
- IPFS Snapshot [(from the `xgov-api` using metadata key `voteGatingSnapshotCid`)][snapshot]

### Gathering the Data Programmatically
Voting Round Application IDs for `mainnet`

```javascript
const INDEXER_SERVER = 'http://localhost'
const INDEXER_PORT = 8980
const INDEXER_TOKEN= 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

const algosdk = require('algosdk')
const indexer = new algosdk.Indexer(INDEXER_TOKEN, INDEXER_SERVER, INDEXER_PORT)

// Account Address that created the Voting Rounds
const creatorAddress = 'C3DQJVL6ZVGL6MZ6JBDBEKYEXRV5NCPZYJUJ3BLRDK6V7ETKYC6NO6HOPA'

const applications = await indexer.lookupAccountCreatedApplications(creatorAddress).do().then(r=>{
  return  r.applications.map(app=>app.id)
}) 

```

Voting Round's Global State

```javascript
//TODO:
```

Voting Round's IPFS Metadata from the `xgov-api`

```javascript
// Mainnet IPFS API
const api = `https://api.voting.algorand.foundation/ipfs/`

const metadata = await Promise.all(globalStates.map(async (globalState)=>{
  const cid = globalState.metadata_ipfs_cid.value
  const url = `${api}${cid}`
  return fetch(url).then(r=>r.json())
}))
```

Voting Round's IPFS Snapshot from the `xgov-api`

```javascript
// Mainnet IPFS API
const api = `https://api.voting.algorand.foundation/ipfs/`

const snapshots = await Promise.all(metadata.map(meta=>{
  const cid = meta.voteGatingSnapshotCid
  const url = `${api}${cid}`
  return fetch(url).then(r=>r.json())
}))
```

## Step 2

Submit a vote for a Voting Round by creating a transaction group composed of the following:

- PaymentTxn: From the Voter to the Application Account
- ApplicationCallTxn: Call the `vote` ABI Method

### ABI Vote Method

```javascript
//TODO
```


# Full Example

```javascript
// TODO

```


[application.json]:[https://github.com/algorandfoundation/nft_voting_tool/tree/main/src/algorand/smart_contracts/artifacts/VotingRoundApp]
[wallet]:[https://app.dappflow.org/explorer/account/C3DQJVL6ZVGL6MZ6JBDBEKYEXRV5NCPZYJUJ3BLRDK6V7ETKYC6NO6HOPA/transactions]
[application]:[https://app.dappflow.org/explorer/application/1158913461/transactions]
[ipfs]:[https://api.voting.algorand.foundation/ipfs/bafkreigjiien52ukmfqd5yrjgonrj6ixpr2rm32szps45ztpehk7z4lhli]
[snapshot]:[https://api.voting.algorand.foundation/ipfs/bafkreieh77pgmvfexyxbnbexwu4n5x54kgdfop7lzfo26peyrjcwhn6uii]
