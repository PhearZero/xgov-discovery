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

```ts
import 'dotenv/config';
const algokit = require('@algorandfoundation/algokit-utils') // or 'algosdk'
const indexer = algokit.getAlgoIndexerClient(); // or new algosdk.Indexer(indexerToken, indexerServer, indexerPort)

// Account Address that created the Voting Rounds
const creatorAddress = 'C3DQJVL6ZVGL6MZ6JBDBEKYEXRV5NCPZYJUJ3BLRDK6V7ETKYC6NO6HOPA'

const applications = await indexer.lookupAccountCreatedApplications(creatorAddress).do().then(r=>{
  return  r.applications.map(app=>app.id)
}) 

```

Voting Round's Global State

```ts
const appSpec = require('./<path_to_artifacts>/application.json')
const algod = algokit.getAlgoClient()

// List of Voting Round Application IDs
const applications = [1158913461]

// Account (can be any algosdk.Account)
const voter = await algokit.getAccount(
  { config: algokit.getAccountConfigFromEnvironment("KMD WALLET")},
  algod
);

// Algokit Clients, will use above wallet for all future transactions
const clients = await Promise.all(applications.map(appId=>{
  return algokit.getAppClient(
    {
      resolveBy: 'id',
      sender: voter,
      app: JSON.stringify(appSpec),
      id: appId,
        
    },
    algod,
  )
}))

// All Application Global States
const globalStates = await Promise.all(clients.map(client=>client.getGlobalState()));
```

Voting Round's IPFS Metadata from the `xgov-api`

```ts
// Mainnet IPFS API
const api = `https://api.voting.algorand.foundation/ipfs/`

const metadata = await Promise.all(globalStates.map(async (globalState)=>{
  const cid = globalState.metadata_ipfs_cid.value
  const url = `${api}${cid}`
  return fetch(url).then(r=>r.json())
}))
```

Voting Round's IPFS Snapshot from the `xgov-api`

```ts
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

```ts
const voter /* algosdk.Account */ = {
  addr: "<VOTER_WALLET>"
}

// Fetched States
const appClient = clients[0]
const globalState = globalStates[0]
const ipfsMetadata = metadata[0]
const snapshotResult = snapshots[0]
const snapshot = snapshotResult.snapshot.find(ss=>{
  // Find the voters snapshot
  return ss.addess === voter.addr
})

const signatureByteArray = Buffer.from( snapshot.signature, "base64");
const voteFee = algokit.microAlgos(1_000 + 16 /* opup - 16 (max possible) */ * 1_000);
const questionIndexes = ipfsMetadata.questions.map(q=>0)
const weightings = ipfsMetadata.questions.map(q=>0);
const weighting = snapshot.weight

// ABI Method Arguments
const args = [
  // PaymentTxn
  appClient.fundAppAccount({
    amount: algokit.microAlgos(400 * /* key size */ (32 + /* value size */ 2 + questionIndexes.length * 1) + 2500),
    sendParams: { skipSending: true }
  }),
  signatureByteArray,
  weighting,
  questionIndexes,
  globalState["vote_type"].value === Number(VoteType.PARTITIONED_WEIGHTING) ? weightings : [],
  globalState["ouaid"]?.value || 0
];

// Compile the Transactions
const txn = await appClient.call({
  method: "vote",
  methodArgs: args,
  boxes: ['V', voter],
  sendParams:{
    skipSending: true,
    fee: voteFee
  }
});

console.log(txn.transactions);
```


# Full Example

```ts
import 'dotenv/config'
import appSpec from './VotingRoundApp/application.json' assert {type: 'json'}
import * as algokit from '@algorandfoundation/algokit-utils'
enum VoteType {
    NO_SNAPSHOT = 0,
    NO_WEIGHTING = 1,
    WEIGHTING = 2,
    PARTITIONED_WEIGHTING = 3,
}

const api = `https://api.voting.algorand.foundation/ipfs/`
const algod = algokit.getAlgoClient()
const indexer = algokit.getAlgoIndexerClient();

const creatorAddress = 'C3DQJVL6ZVGL6MZ6JBDBEKYEXRV5NCPZYJUJ3BLRDK6V7ETKYC6NO6HOPA'
const applications = await indexer.lookupAccountCreatedApplications(creatorAddress).do().then(r=>{
    return  r.applications.map(app=>app.id)
})


const voter = await algokit.getAccount(
    { config: algokit.getAccountConfigFromEnvironment("VOTER") },
    algod
);

const clients = await Promise.all(applications.map(appId=>{
    return algokit.getAppClient(
        {
            resolveBy: 'id',
            sender: voter,
            app: JSON.stringify(appSpec),
            id: appId,

        },
        algod,
    )
}))


const globalStates = await Promise.all(clients.map(client=>client.getGlobalState()));

const metadata = await Promise.all(globalStates.map(async (globalState)=>{
    const cid = globalState.metadata_ipfs_cid.value
    const url = `${api}${cid}`
    return fetch(url).then(r=>r.json())
}))


const snapshots = await Promise.all(metadata.map(meta=>{
    const cid = meta.voteGatingSnapshotCid
    const url = `${api}${cid}`
    return fetch(url).then(r=>r.json())
}))


const appClient = clients[0]
const globalState = globalStates[0]
const ipfsMetadata = metadata[0]
const snapshotResult = snapshots[0]
const snapshot = snapshotResult.snapshot.find(ss=>{
    return ss.address === voter.addr
})

const signatureByteArray = Buffer.from( snapshot.signature, "base64");
const voteFee = algokit.microAlgos(1_000 + 16 /* opup - 16 (max possible) */ * 1_000);
const questionIndexes = ipfsMetadata.questions.map(q=>0)
const weightings = ipfsMetadata.questions.map(q=>0);
// Set weights on votes
weightings[0] = snapshot.weight

// ABI Method Arguments
const args = [
    // PaymentTxn
    appClient.fundAppAccount({
        amount: algokit.microAlgos(400 * /* key size */ (32 + /* value size */ 2 + questionIndexes.length * 1) + 2500),
        sendParams: { skipSending: true }
    }),
    signatureByteArray,
    snapshot.weight,
    questionIndexes,
    globalState["vote_type"].value === Number(VoteType.PARTITIONED_WEIGHTING) ? weightings : [],
    globalState["ouaid"]?.value || 0
];

// Compile the Transactions
const txn = await appClient.call({
    method: "vote",
    methodArgs: args,
    boxes: ['V', voter],
    sendParams:{
        skipSending: true,
        fee: voteFee
    }
});

console.log(txn.transactions);
```


[application.json]:[https://github.com/algorandfoundation/nft_voting_tool/tree/main/src/algorand/smart_contracts/artifacts/VotingRoundApp]
[wallet]:[https://app.dappflow.org/explorer/account/C3DQJVL6ZVGL6MZ6JBDBEKYEXRV5NCPZYJUJ3BLRDK6V7ETKYC6NO6HOPA/transactions]
[application]:[https://app.dappflow.org/explorer/application/1158913461/transactions]
[ipfs]:[https://api.voting.algorand.foundation/ipfs/bafkreigjiien52ukmfqd5yrjgonrj6ixpr2rm32szps45ztpehk7z4lhli]
[snapshot]:[https://api.voting.algorand.foundation/ipfs/bafkreieh77pgmvfexyxbnbexwu4n5x54kgdfop7lzfo26peyrjcwhn6uii]
