import { hashTypedData } from 'viem';
import { useCallback } from 'react';
import { useAccount, useSignTypedData } from 'wagmi';
import { baseSepolia } from 'wagmi/chains'

// EIP-3009 Transfer With Authorization interface
export interface TransferWithAuthorization {
  from: `0x${string}`;
  to: `0x${string}`;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: `0x${string}`;
  chainId: number;
  verifyingContract: `0x${string}`;
  name: string;
  version: string;
}

// EIP-712 type definition
const TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

// Generate a random nonce
function generateNonce(): `0x${string}` {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return `0x${Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

// Create a transfer authorization message
function createTransferAuthorization(
  from: `0x${string}`,
  to: `0x${string}`,
  value: string,
  name: string,
  version: string,
  verifyingContract: `0x${string}`,
  validForSeconds: number = 3600
): TransferWithAuthorization {
  const now = Math.floor(Date.now() / 1000);
  
  return {
    from,
    to,
    value,
    validAfter: now.toString(),
    validBefore: (now + validForSeconds).toString(),
    nonce: generateNonce(),
    chainId: baseSepolia.id,
    verifyingContract: verifyingContract,
    name: name,
    version: version,
  };
}

// Create EIP-712 typed data with dynamic domain
function createTypedData(
  message: TransferWithAuthorization, 
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: `0x${string}`;
  }
) {
  return {
    domain,
    types: TYPES,
    primaryType: 'TransferWithAuthorization' as const,
    message: {
      from: message.from,
      to: message.to,
      value: BigInt(message.value),
      validAfter: BigInt(message.validAfter),
      validBefore: BigInt(message.validBefore),
      nonce: message.nonce,
    },
  };
}

// Hook for signing transfer authorizations
export function useTransferAuthorization() {
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync, isPending } = useSignTypedData();

  const signTransfer = useCallback(async (
    to: `0x${string}`,
    value: string,
    domain: {
      name: string;
      version: string;
      chainId: number;
      verifyingContract: `0x${string}`;
    },
    validForSeconds?: number
  ) => {
    if (!address || !isConnected) return null;

    try {
      const message = createTransferAuthorization(address, to, value, domain.name, domain.version, domain.verifyingContract, validForSeconds);
      const typedData = createTypedData(message, domain);
      const signature = await signTypedDataAsync(typedData);
      const hash = hashTypedData(typedData);

      console.log('=== Transfer Authorization ===');
      console.log('Message:', message);
      console.log('Domain:', domain);
      console.log('Hash:', hash);
      console.log('Signature:', signature);
      console.log('============================');

      return { message, typedData, hash, signature };
    } catch (error) {
      console.error('Failed to sign transfer:', error);
      return null;
    }
  }, [address, isConnected, signTypedDataAsync]);

  return {
    signTransfer,
    isConnected,
    address,
    isPending,
  };
}