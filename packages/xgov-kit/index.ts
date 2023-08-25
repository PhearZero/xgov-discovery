#!/usr/bin/env node

import 'dotenv/config'
import {program} from 'commander'
import chalk from "chalk";
import {checkbox, input, confirm, select} from "@inquirer/prompts";
import {createRequire} from "node:module";

// App Dependencies
import algosdk from 'algosdk';
import * as algokit from '@algorandfoundation/algokit-utils'
const require = createRequire(import.meta.url);
const appSpec = require('@algorandfoundation/xgov-contract/application.json')

const BANNER = chalk.green(`         ________             
___  ___/  _____/  _______  __
\\  \\/  /   \\  ___ /  _ \\  \\/ /
 >    <\\    \\_\\  (  <_> )   / 
/__/\\_ \\\\______  /\\____/ \\_/  
      \\/       \\/             
`) + chalk.yellow(`Algorand's Decentralized Voting App\n`)

console.log(BANNER)
program
    .option('-w, --wallet <wallet>', 'kmd wallet name', 'unencrypted-default-wallet')
    .option('-i, --ipfs <ipfs>', 'url of the ipfs backend', process.env.IPFS_URL || 'https://api.voting.algorand.foundation/ipfs')
    .option( '-c, --creator <creator>', 'creator of the application', process.env.CREATOR_ADDRESS || 'C3DQJVL6ZVGL6MZ6JBDBEKYEXRV5NCPZYJUJ3BLRDK6V7ETKYC6NO6HOPA')

program.parse();

const options = program.opts()

enum VoteType {
    NO_SNAPSHOT = 0,
    NO_WEIGHTING = 1,
    WEIGHTING = 2,
    PARTITIONED_WEIGHTING = 3,
}

type AlgoApp = {
    id: number;
}

// Options
const api = options.ipfs.replace(/\/$/, '');
const creatorAddress = options.creator

// Algorand Clients
const algod = algokit.getAlgoClient()
const indexer = algokit.getAlgoIndexerClient();


// List of application IDs
const applications = await indexer.lookupAccountCreatedApplications(creatorAddress).do().then(r=>{
    return  r.applications.map((app: AlgoApp)=>app.id)
})

// Current User
const voter = await algokit.getAccount(
    { config: algokit.getAccountConfigFromEnvironment(options.wallet)},
    algod
);

// Application Clients
const clients = await Promise.all(applications.map((appId: number)=>{
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


// Global Application State
const globalStates = await Promise.all(clients.map(client=>client.getGlobalState()));

// Snapshot Metadata
const metadata = await Promise.all(globalStates.map(async (globalState)=>{
    const cid = globalState.metadata_ipfs_cid.value
    const url = `${api}/${cid}`
    return fetch(url).then(r=>r.json())
}))

// Get User's Voting History
const voterStates = await Promise.all(
    clients.map(client => client.getBoxValue(
        algosdk.decodeAddress(voter.addr).publicKey
    ).catch((e: any)  => {
        if (e.status === 404){
            return undefined
        } else {
            throw e
        }
    }))
);

// Voting Snapshots of allowed Users and weights
const snapshots = await Promise.all(metadata.map(async (meta, index)=>{
    const cid = meta.voteGatingSnapshotCid
    const url = `${api}/${cid}`
    return {
        ipfs: await fetch(url).then(r=>r.json()),
        index
    }
}))

// Get the users snapshots
const user_snapshots = snapshots.filter((snapshotResult)=>{
    const result = snapshotResult.ipfs.snapshot.find((ss: any)=>{
        return ss.address === voter.addr
    })
    return result !== undefined
})
if(user_snapshots.length === 0){
    console.log(chalk.red('Not eligible to vote'))
    process.exit(1)
}

// Choices for voting
const choices = user_snapshots.map((snapshotResult)=>{
    const result: {name: string, value: number, description?: string, disabled?: string} = {
        name: snapshotResult.ipfs.title,
        value: snapshotResult.index,
    }

    if(typeof metadata[snapshotResult.index].description === 'string'){
        result.description = metadata[snapshotResult.index].description
    }

    if(typeof metadata[snapshotResult.index].informationUrl === 'string'){
        result.description = result.description + `\nSee ${metadata[snapshotResult.index].informationUrl} for more information.`
    }
    if(voterStates[snapshotResult.index] !== undefined){
        result.disabled = "(voted)"
    }
    return result
})

if(!choices.find((c)=>!c.disabled)){
    console.log(chalk.green('Already voted in all rounds'))
    process.exit(0)
}
const appIndex = await select({
    message: 'Select Voting Round',
    choices
})

// Let's vote!!!

const appClient = clients[appIndex]
const globalState = globalStates[appIndex]
const ipfsMetadata = metadata[appIndex]
const snapshotResult = snapshots[appIndex].ipfs

const snapshot = snapshotResult.snapshot.find((ss: any)=>{
    return ss.address === voter.addr
})

const signatureByteArray = Buffer.from( snapshot.signature, "base64");
const voteFee = algokit.microAlgos(1_000 + 16 /* opup - 16 (max possible) */ * 1_000);
const questionIndexes = ipfsMetadata.questions.map((q:any)=>0)
const weightings = ipfsMetadata.questions.map((q:any)=>0);


const selectedQuestions = await checkbox({
    message: 'Select Questions',
    choices: ipfsMetadata.questions.map((q:any, index: number)=>({name: q.prompt, value: index })),
});

let remaining = snapshot.weight
for(const index of selectedQuestions){
    const question = chalk.cyan(ipfsMetadata.questions[index as number].prompt)
    const userVote = await input({
        message: `Enter vote weight for ${question} (${remaining} available):`,
        validate: (value: string)=>{
            return !!parseInt(value) && parseInt(value) <= remaining ?
                true :
                `Invalid weight, ${remaining} remaining votes`
        }
    });
    weightings[index as number] = parseInt(userVote)
    remaining = remaining - parseInt(weightings[index as number])
}

const submitTransactions = await confirm({
    message: chalk.green('Submit transaction?'),
})

let confirmSubmit = false
if(submitTransactions){
    confirmSubmit = await confirm({
        message: chalk.red('Are you sure you want to submit transaction, this cannot be undone?'),
    })
}

// ABI Method Arguments
const args = [
    // PaymentTxn
    appClient.fundAppAccount({
        amount: algokit.microAlgos(400 * /* key size */ (32 + /* value size */ 2 + questionIndexes.length * 1) + 2500),
        sendParams: { skipSending: !confirmSubmit }
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
        skipSending: !confirmSubmit,
        fee: voteFee
    }
});

if(!confirmSubmit){
    console.log(txn.transactions);
}
