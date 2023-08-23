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
    { config: algokit.getAccountConfigFromEnvironment("VOTER"), fundWith: algokit.algos(3000) },
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
