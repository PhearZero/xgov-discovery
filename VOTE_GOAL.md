# Overview

Voting with `goal` and `algod`

### Links:

- [Current Application][app]
- [Current Snapshot][snapshot]
- [Current Questions][questions]


### Arguments:

 - **Wallet Address:** Voters wallet
 - **Voting Round Application ID**: `1158913461` (current voting round)
 - **Question Options**: `[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]` (index of questions)
 - **Weighted Vote**: `[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]`
   - Should equal total weight for the Wallet Address in the [Snapshot][snapshot]

```shell
./vote.sh -w  <Wallet Address> -a <Voting Round Application Id> -q <Question Options> -v <Weighted Vote>
```

### Outputs:

A `VoteRound.txn` is produced and can be signed and sent using `goal`.

### Signing:

Signing the VoteRound.txn
```shell
goal clerk sign -i VoteRound.txn -o VoteRoundSigned.txn
```

Sending the Signed Transaction
```shell
goal clerk rawsend -f VoteRoundSigned.txn
```

### Example in sandbox:

Creating the VoteRound.txn
```shell
# Create VoteRound.txn
 ./vote.sh -w GC6CO7Q5MP47VAVICBZ5C5UEGQDG7YXSUTFFOLGXMQYN2AZTJGUIR73EAI -a 1001 -q [0,0] -v [1,1] -i http://192.168.101.245:3000/ipfs
goal clerk sign -i VoteRound.txn -o VoteRoundSigned.txn
goal clerk rawsend -f VoteRoundSigned.txn
# Outputs
#Raw transaction ID 5VVJEHQFHBTGZPOO7DR5S2VPOOTXGX4NHWXBBQQQNXZQSNISKXPA issued
#Raw transaction ID 37HM4GERZWSZBMNUKSTEFJU6JE6HKQQTDQU6IVAB3LWEAH2TWHCA issued
#Transaction 5VVJEHQFHBTGZPOO7DR5S2VPOOTXGX4NHWXBBQQQNXZQSNISKXPA committed in round 824634407160
#Transaction 37HM4GERZWSZBMNUKSTEFJU6JE6HKQQTDQU6IVAB3LWEAH2TWHCA committed in round 824634407864
```

[app]:https://app.dappflow.org/explorer/application/1158913461/transactions
[snapshot]:https://api.voting.algorand.foundation/ipfs/bafkreieh77pgmvfexyxbnbexwu4n5x54kgdfop7lzfo26peyrjcwhn6uii
[questions]:https://api.voting.algorand.foundation/ipfs/bafkreigjiien52ukmfqd5yrjgonrj6ixpr2rm32szps45ztpehk7z4lhli
