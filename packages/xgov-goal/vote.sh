#!/usr/bin/env bash

set -e

IPFS_API=https://api.voting.algorand.foundation/ipfs
OUTPUT=VoteRound.txn
BANNER=$(cat <<-EndOfMessage
\033[0;32m         ________
___  ___/  _____/  _______  __
\  \/  /   \  ___ /  _ \  \/ /
 >    <\    \_\  (  <_> )   /
/__/\_ \\______  /\____/  \_/
      \/       \/
\033[1;33mAlgorand's Decentralized Voting App

\033[0m
EndOfMessage
)
printf "$BANNER"

usage() {
  echo "Usage: $0 [flags]" 1>&2;
  echo
  echo "Flag        Description"
  echo "-w          Wallet Address"
  echo "-a          Voting Round Application ID"
  echo "-q          Question Options (example: [0,0,0])"
  echo "-v          Weighted Vote (example: [1,0,0])"
  echo "-i          IPFS URL (default: https://api.voting.algorand.foundation/ipfs)"
  echo "-o          File Output (default: VoteRound.txn)"
  echo
  exit 1;
}

while getopts ":w:a:q:v:i:o:" o; do
    case "${o}" in
        w)
            VOTER_WALLET=${OPTARG}
            ;;
        a)
            APP_ID=${OPTARG}
            ;;
        q)
            VOTE_QUESTION_OPTIONS=${OPTARG}
            ;;
        v)
            VOTE_WEIGHTS=${OPTARG}
            ;;
        i)
            IPFS_API=${OPTARG}
            ;;
        o)
            OUTPUT=${OPTARG}
            ;;
        *)
            usage
            ;;
    esac
done
shift $((OPTIND-1))

if [ -z "${APP_ID}" ] ||
   [ -z "${VOTER_WALLET}" ] ||
   [ -z "${VOTE_QUESTION_OPTIONS}" ] ||
   [ -z "${VOTE_WEIGHTS}" ]; then
    usage
fi


# App State
APP_WALLET=$(goal app info --app-id "$APP_ID" | sed -n '2 p' | awk '{print $3}')
APP_GLOBAL_STATE=$(goal app read --app-id "$APP_ID" --global --guess-format)
APP_OUAID=$(echo "$APP_GLOBAL_STATE" | jq ".ouaid | .ui")

# Metadata
IPFS_METADATA_CID=$(echo "$APP_GLOBAL_STATE" | jq -r ".metadata_ipfs_cid | .tb" )
IPFS_METADATA=$(curl -s "$IPFS_API"/"$IPFS_METADATA_CID" )

# Snapshot
IPFS_SNAPSHOT_CID=$(echo "$IPFS_METADATA" | jq -r '.voteGatingSnapshotCid')
IPFS_SNAPSHOT=$(curl -s "$IPFS_API"/"$IPFS_SNAPSHOT_CID")

# Arguments
NUM_QUESTIONS=$(echo "$IPFS_METADATA" | jq '.questions | length')
SIGNATURE=$(echo "$IPFS_SNAPSHOT" | jq ".snapshot | map(select(.address | contains(\"$VOTER_WALLET\"))) | .[] | .signature")
WEIGHT=$(echo "$IPFS_SNAPSHOT" | jq ".snapshot | map(select(.address | contains(\"$VOTER_WALLET\"))) | .[] | .weight")
PAYMENT_AMOUNT=$((400*(32+2+NUM_QUESTIONS*1)+2500))
VOTE_FEE=$((1000 + 16 * 1000))
BOX_NAME=$(echo -n "V" | base64 -w0)

# Payment Txn
goal clerk send -a $PAYMENT_AMOUNT -f "$VOTER_WALLET" -t "$APP_WALLET" -o Payment.txn

# Application Txn
goal app method \
 --app-id "$APP_ID" \
 --method="vote(pay,byte[],uint64,uint8[],uint64[],application)void" \
 --from "$VOTER_WALLET" \
 --arg "Payment.txn" \
 --arg "$SIGNATURE" \
 --arg "$WEIGHT" \
 --arg "$VOTE_QUESTION_OPTIONS" \
 --arg "$VOTE_WEIGHTS" \
 --arg "$APP_OUAID" \
 --fee $VOTE_FEE \
 --box "b64:$BOX_NAME" \
 --box "addr:$VOTER_WALLET" \
 -o "$OUTPUT"
