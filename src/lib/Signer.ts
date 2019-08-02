import { Resolvers, ApolloError } from 'apollo-client'
import gql from 'graphql-tag'
import { client, cache } from './GraphQL'
import { RNUportHDSigner, getSignerForHDPath } from 'react-native-uport-signer'
import { createJWT } from 'did-jwt'
import analytics from '@segment/analytics-react-native'
import Log from './Log'

// ANDROID OPTIONS
//
// `singleprompt` - Prompt is only asked once per session or period of time
// `prompt`       - Prompt every time
// `simple`       - Not hardware protected but you don't loose your key if you change pin
// `cloud`        - Backed up in some cloud storage

export const DEFAULT_LEVEL = 'simple'
export const SHOW_SEED_PROMPT = 'Do you want to reveal seed phrase?'

export interface Did {
  did: string
  address: string
  seed?: string
  isSelected: boolean
  __typename?: string
}

const getSelectedDidQuery = gql`
  query getSelectedDid {
    selectedDid @client
  }
`

export const getDidsQuery = gql`
  query getDids {
    dids @client {
      did
      address
      seed
      isSelected
    }
    selectedDid @client
  }
`
export const resolvers: Resolvers = {
  Did: {
    seed: async (did: Did, args, context) => {
      return await RNUportHDSigner.showSeed(did.address, SHOW_SEED_PROMPT)
    },
  },
  Query: {
    dids: async (_, args, context) => {
      const list = await RNUportHDSigner.listSeedAddresses()
      const { selectedDid }: any = cache.readQuery({
        query: getSelectedDidQuery,
      })
      return list.map((address: string) => ({
        did: 'did:ethr:' + address,
        address,
        isSelected: selectedDid === 'did:ethr:' + address,
        __typename: 'Did',
      })) as Did[]
    },
  },
  Mutation: {
    createDid: async (_, args, context) => {
      const { address } = await RNUportHDSigner.createSeed(DEFAULT_LEVEL)
      const did = 'did:ethr:' + address
      Log.info('Created: ' + did, 'Signer')
      analytics.track('Identity created', { type: 'did:ethr' })
      return {
        did,
        address,
        __typename: 'Did',
      } as Did
    },
    importSeed: async (_, { seed }, context) => {
      const { address } = await RNUportHDSigner.importSeed(seed, DEFAULT_LEVEL)
      const did = 'did:ethr:' + address
      Log.info('Seed imported: ' + did, 'Signer')
      analytics.track('Seed imported')
      return {
        did,
        address,
        __typename: 'Did',
      } as Did
    },
    deleteSeed: async (_, { address }, context) => {
      const result = await RNUportHDSigner.deleteSeed(address)
      const did = 'did:ethr:' + address
      Log.info('Deleted: ' + did, 'Signer')
      analytics.track('Identity deleted', { type: 'did:ethr' })
      return result
    },
    // This is only an example of how to use getSignerForHDPath with did-jwt:
    signJwt: async (_, { address }, context) => {
      const signer: any = getSignerForHDPath(address)
      const did = 'did:ethr:' + address
      const vc = {
        sub: did,
        claim: {
          name: 'uPort Developer',
        },
      }
      const jwt = await createJWT(vc, {
        issuer: did,
        signer,
        alg: 'ES256K-R',
      })
      Log.info('Signed: ' + jwt, 'Signer')
      return jwt
    },
  },
}

client.addResolvers(resolvers)

export const importSeedMutation = gql`
  mutation importSeed($seed: String!) {
    importSeed(seed: $seed) @client
  }
`

export const deleteSeedMutation = gql`
  mutation deleteSeed($address: String!) {
    deleteSeed(address: $address) @client
  }
`

export const createDidMutation = gql`
  mutation createDid {
    createDid @client {
      did
    }
  }
`
export const signJwtMutation = gql`
  mutation signJwt($address: String!) {
    signJwt(address: $address) @client
  }
`
