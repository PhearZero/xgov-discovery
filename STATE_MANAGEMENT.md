# Overview

`xgov` uses the experimental `recoil` library by react/meta. We should collect all state mutations and reflections that relate
to the core business logic in a centralized location and adopt a strategy pattern to improve discovery and maintainability.

## Current Layout

The project has a few reused interfaces for the contract api calls and a couple of `state.ts` files that contain the `recoil` state. This is also
inconsistent, the majority of the state is using the contract interfaces directly and bypassing `recoil` by using `useEffect`. 

For example
`globalState` is [fetched in a useEffect](https://github.com/algorandfoundation/nft_voting_tool/blob/main/src/xgov-dapp/src/features/vote/index.tsx#L137)
in features leading to re-fetching of data we should already have in the state. This is not ideal, we should be able to use a state library directly and not have to worry about the
lengthy data fetching operations in the UI component.

- Contract Interface(dapp): [src/shared/VotingRoundContract](https://github.com/algorandfoundation/nft_voting_tool/blob/main/src/dapp/src/shared/VotingRoundContract.ts)
- IPFS Gateway Interface(dapp): [src/shared/IPFSGateway](https://github.com/algorandfoundation/nft_voting_tool/blob/main/src/dapp/src/shared/IPFSGateway.ts)
- State Example(xgov-dapp): [src/features/*/state.ts](https://github.com/algorandfoundation/nft_voting_tool/blob/main/src/xgov-dapp/src/features/vote-creation/state.ts)
- Effect Example(xgov-dapp): [src/features/*/index.tsx](https://github.com/algorandfoundation/nft_voting_tool/blob/main/src/xgov-dapp/src/features/vote/index.tsx#L129)

## Paths forward

## ~~1. recoil~~ (not recommended)

It is still very experimental and not really recommended for production use.

 - Website: https://recoiljs.org/
 - Package: https://www.npmjs.com/package/recoil
 - Weekly Downloads: **571,351**
 - Version: `0.7.7`

Note: This is pseudocode obfuscating a lot of the complexity of `recoil` for brevity.

```typescript
import {globalStateAtom} from './atoms'
import { fetchGlobalState } from './selectors'
function useGlobalStateQuery(appId: number){
    const [isLoading, setIsLoading]= useState(true)
    const [error, setError] = useState<Error>()
    const [isError, setIsError] = useState(false)
    
    const [globalState, setGlobalState] = useRecoilState(globalStateAtom)
    
    useEffect(()=>{
        if(globalState) {
            isLoading(false)
            return
        }
        fetchGlobalState(appId).then((state)=>{
            setGlobalState(state)
            setIsLoading(false)
        }).catch(e=>{
            setIsError(true)
            setError(e)
            setLoading(false)
        });
    }, [appId, globalState])

    // Return a query response to react to in the UI
    return {isLoading, error, isError, data: globalState}
}
```
## 2. @reduxjs/toolkit

Opinionated Redux framework with traditional `actions`, `selectors`, and `reducers`. High level of effort
with strong community support. Is very competitive with `react-query`, see their [comparison chart]( https://redux-toolkit.js.org/rtk-query/comparison#comparing-feature-sets)

 - Site: https://redux-toolkit.js.org/
 - Package: https://www.npmjs.com/package/@reduxjs/toolkit
 - Weekly Downloads: **2,666,001**

#### Example Query Hook:

Note: This is pseudocode obfuscating a lot of the complexity of `redux-toolkit` and `redux` for brevity.

```typescript
import { useAppSelector, useAppDispatch } from './redux'
import { fetchGlobalState } from './actions'

export function useGlobalStateQuery(appId: number){
    const [isLoading, setIsLoading]= useState(true)
    const [error, setError] = useState<Error>()
    const [isError, setIsError] = useState(false)
    
    const dispatch = useAppDispatch()
    const globalState = useAppSelector(state => state.globalState[appId])
    
    useEffect(()=>{
        if(globalState) {
            setIsLoading(false)
            return
        }
        setIsLoading(true)
        try{
            dispatch(fetchGlobalState(appId))
            setIsLoading(false)
        } catch (e) {
            setIsError(true)
            setError(e)
            setLoading(false)
        }
        
    }, [appId, globalState])
    
    // Return a query response to react to in the UI
    return {isLoading, error, isError, data: globalState}
}
```


## 3. @tanstack/react-query

Less opinionated query library with a focus on ease of use. Lowest level of effort, one of the most widely adopted in the ecosystem.
v4 is agnostic to the renderer. It can be used with vanilla JS/TS or React | Vue | Solid | Svelte.

- Website: https://tanstack.com/query/latest
- Package v4: https://www.npmjs.com/package/@tanstack/react-query
- Weekly Downloads: **1,865,328**
- Package v3: https://www.npmjs.com/package/react-query
- Weekly Downloads: **1,499,639**

#### Example Query Hook:

This is a feature complete example, It will reflect/deduplicate by cache key any Object returned in the query method.

```typescript
import { useQuery } from '@tanstack/react-query'
import { VotingRoundContract } from './shared/VotingRoundContract'
// Cached reusable hook with window focus and polling
export function useGlobalStateQuery(voteId: number) {
  return useQuery<GlobalStateType>(
    // Key to cache request on
    ['globalState', voteId],
    // Fetch action/slice
    async () => {
      return await VotingRoundContract.getGlobalState(voteId);
    }
  );
}
```


## Query Pattern

Until `Suspense` and `Error` boundaries are stable in React, we should use a standard response interface.
The interface should be post-fixed `Query` to infer the response shape. 

Query hooks should live in a reusable package that can be imported into projects. 
Any state management library can be used, but the response interface should be the consistent for the consumers. 

Example using `react-query` style strategy pattern (supports generics):
```typescript
/**
 * Standardized response for all query hooks
 */
interface QueryHookResponseType {
    data: any; // Infered type from generics
    isLoading: boolean;
    isFetched: boolean;
    isFetching: boolean;
    isError: boolean;
    error?: Error;
}

/**
 * Get the Global State from the Application Id
 * 
 * Should have no dependencies on other hooks.
 * 
 * @param {number} voteId
 */
declare function useGlobalStateQuery<GlobalStateType>(voteId: number): QueryHookResponseType;

/**
 * Get the Metadata from the IPFS CID
 * 
 * Depends on the metadataCid from the Global State Query
 * 
 * @param {string} metadataCid
 */
declare function useMetadataQuery<Metadata>(metadataCid: string): QueryHookResponseType;

/**
 * Get the Snapshot from the IPFS Metadata
 * 
 * Depends on the voteGatingSnapshotCid from the Metadata Query
 * 
 * @param {string} gatingSnapshotCid
 */
declare function useSnapshotQuery<Snapshot>(gatingSnapshotCid: string): QueryHookResponseType;

/**
 * Get the Governors for a Voting Round
 * 
 * Is a composition of the Global State, Metadata, and Snapshot Queries. 
 * Returning the governors for the current voting round.
 * 
 * @param {number} voteId
 */
declare function useGovernorsQuery<GovernorsList>(voteId: number): QueryHookResponseType;

/**
 * Get the Vote actions for a Voting Round
 * 
 * Should compose gobals and run any Query strategies required. 
 * Returns a useable voting interface based on the current
 * voting round and user logged in.
 * 
 * @param {number} voteId
 */
declare function useVote<VotingInterface>(voteId: number): QueryHookResponseType;

```

## Store Pattern

Post-fixing `Store` but allow any shape the app requires and rely on types. Most data will be provided by either `react-toolkit query` or
`react-query` using the `Query Strategy`. The store should only be used for global UI state and user configurable settings.

Example using `zustand` (state store used in @txnlab/use-wallet):

```typescript
import { create } from 'zustand'

type GlobalThemeStoreType = {
    theme: string
    toggle: () => void
}

// Store state with actions
const useThemeStore = create<GlobalThemeStoreType>()((set) => ({
    // Initial State, this store can be composed with zustand middleware to persist to localstorage.
    theme: "dark",
    // Reducer/action combined into one statement. Exported as an interface which can be used in the UI.
    toggle: () => set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),
}))

```
