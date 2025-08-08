export const PORTO_ABI = [
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
    }
  ] as const
  