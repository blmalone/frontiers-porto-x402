export const PORTO_ABI = [
    {
      inputs: [],
      name: 'keyCount',
      outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
      name: 'keyAt',
      outputs: [
        {
          components: [
            { internalType: 'uint40', name: 'expiry', type: 'uint40' },
            { internalType: 'uint8', name: 'keyType', type: 'uint8' },
            { internalType: 'bool', name: 'isSuperAdmin', type: 'bool' },
            { internalType: 'bytes', name: 'publicKey', type: 'bytes' },
          ],
          internalType: 'struct Key',
          name: '',
          type: 'tuple',
        },
      ],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [
        {
          components: [
            { internalType: 'address', name: 'target', type: 'address' },
            { internalType: 'uint256', name: 'value', type: 'uint256' },
            { internalType: 'bytes', name: 'data', type: 'bytes' },
          ],
          internalType: 'struct Call[]',
          name: 'calls',
          type: 'tuple[]',
        },
        { internalType: 'uint256', name: 'nonce', type: 'uint256' },
      ],
      name: 'computeDigest',
      outputs: [{ internalType: 'bytes32', name: 'result', type: 'bytes32' }],
      stateMutability: 'view',
      type: 'function',
    },
    {
        type: "function",
        name: "DOMAIN_TYPEHASH",
        inputs: [],
        outputs: [
            {
                name: "",
                type: "bytes32",
                internalType: "bytes32"
            }
        ],
        stateMutability: "view"
    },
    {
        type: "function",
        name: "eip712Domain",
        inputs: [],
        outputs: [
            {
                name: "fields",
                type: "bytes1",
                internalType: "bytes1"
            },
            {
                name: "name",
                type: "string",
                internalType: "string"
            },
            {
                name: "version",
                type: "string",
                internalType: "string"
            },
            {
                name: "chainId",
                type: "uint256",
                internalType: "uint256"
            },
            {
                name: "verifyingContract",
                type: "address",
                internalType: "address"
            },
            {
                name: "salt",
                type: "bytes32",
                internalType: "bytes32"
            },
            {
                name: "extensions",
                type: "uint256[]",
                internalType: "uint256[]"
            }
        ],
        stateMutability: "view"
    },
    {
        type: "function",
        name: "getNonce",
        inputs: [
            {
                name: "seqKey",
                type: "uint192",
                internalType: "uint192"
            }
        ],
        outputs: [
            {
                name: "",
                type: "uint256",
                internalType: "uint256"
            }
        ],
        stateMutability: "view"
    }
  ] as const
  