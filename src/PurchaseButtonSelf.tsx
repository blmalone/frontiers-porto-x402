import { useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { SERVER_URL } from './constants';
import { useTransferAuthorization } from './eip3009';

interface FortuneData {
  price: string;
  fortune: string;
  category: string;
  luckyNumber: string;
}

/**
 * A simple component that fetches fortune data
 */
export const PurchaseButtonSelf = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { signTransfer, isPending: isSigningPending } = useTransferAuthorization();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successData, setSuccessData] = useState<FortuneData | null>(null);

  const handlePurchase = async () => {
    setIsProcessing(true);
    setIsSuccess(false);
    setSuccessData(null);

    try {
      // Check if user's address has code deployed
      if (address && publicClient && walletClient) {
        const bytecode = await publicClient.getBytecode({ address });
        if (bytecode && bytecode !== '0x') {
          console.log(`${address} is deployed`);
        } else {
          console.log(`${address} isn't deployed yet`);
          
          // Force deploy the Porto account using empty sendCalls
          console.log('Deploying Porto account...');
          try {
            // Use wallet_sendCalls with empty calls to trigger counterfactual deployment
            const deployResult = await (walletClient as any).request({
              method: 'wallet_sendCalls',
              params: [{
                calls: [], // Empty calls array to trigger deployment
                version: '1.0',
                chainId: `0x${(84532).toString(16)}`, // Base Sepolia chain ID in hex
                from: address
              }]
            });
            console.log('Porto account deployed successfully:', deployResult);
          } catch (error) {
            console.error('Failed to deploy Porto account:', error);
            throw new Error('Failed to deploy Porto account');
          }
        }
      }
      // First request without payment header
      const initialResponse = await fetch(`${SERVER_URL}/api/self/fortune`);
      
      if (initialResponse.ok) {
        const fortuneData = await initialResponse.json();
        setIsSuccess(true);
        setSuccessData(fortuneData);
        return;
      }
      
      // Handle 402 Payment Required
      if (initialResponse.status === 402) {
        const paymentRequirements = await initialResponse.json();
        console.log('Payment required:', paymentRequirements);
        
        // Create EIP-3009 typed data from payment requirements
        const domain = {
          name: paymentRequirements.extra.name,
          version: paymentRequirements.extra.version,
          chainId: 84532, // Base Sepolia - hardcoded
          verifyingContract: paymentRequirements.asset as `0x${string}`
        };
        
        const transferResult = await signTransfer(
          paymentRequirements.payTo as `0x${string}`,
          paymentRequirements.maxAmountRequired,
          domain,
          paymentRequirements.maxTimeoutSeconds
        );
        
        if (!transferResult) {
          throw new Error('Failed to sign transfer authorization');
        }
        
        console.log('Created EIP-3009 transfer authorization:', transferResult);
        
        // Create the X-PAYMENT header payload
        const paymentPayload = {
          x402Version: 1,
          scheme: "exact",
          network: "base-sepolia",
          payload: {
            signature: transferResult.signature,
            authorization: {
              from: transferResult.message.from,
              to: transferResult.message.to,
              value: transferResult.message.value,
              validAfter: transferResult.message.validAfter,
              validBefore: transferResult.message.validBefore,
              nonce: transferResult.message.nonce
            }
          }
        };
        
        // Encode as base64 JSON
        const paymentHeader = btoa(JSON.stringify(paymentPayload));
        console.log('Payment header payload:', paymentPayload);
        console.log('Base64 encoded header:', paymentHeader);
        
        // Retry with the structured X-PAYMENT header
        const paymentResponse = await fetch(`${SERVER_URL}/api/self/fortune`, {
          headers: {
            'X-PAYMENT': paymentHeader
          }
        });
        
        if (paymentResponse.ok) {
          const fortuneData = await paymentResponse.json();
          setIsSuccess(true);
          setSuccessData(fortuneData);
        } else {
          throw new Error(`Payment processing failed: ${paymentResponse.status} ${paymentResponse.statusText}`);
        }
      } else {
        throw new Error(`Failed to fetch fortune data: ${initialResponse.status} ${initialResponse.statusText}`);
      }
    } catch (error) {
      console.error('Purchase failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="component-container">
      <div className="button-group">
        <button
          onClick={handlePurchase}
          disabled={isProcessing || isSigningPending || !address}
          className="primary-button"
        >
          {isProcessing ? 'Processing...' : isSigningPending ? 'Signing...' : 'Pay'}
        </button>

        {isSuccess && successData && (
          <div className="success-message">
            ✅ ${successData.price} purchase complete
            <div style={{ marginTop: '12px', fontSize: '14px', lineHeight: '1.4' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Your Fortune:</div>
              <div>🔮 <strong>Fortune:</strong> {successData.fortune}</div>
              <div>📂 <strong>Category:</strong> {successData.category}</div>
              <div>🍀 <strong>Lucky Number:</strong> {successData.luckyNumber}</div>
            </div>
          </div>
        )}

        {!address && (
          <p className="helper-text">
            Please connect your Porto wallet first
          </p>
        )}
      </div>
    </div>
  );
};

export default PurchaseButtonSelf;