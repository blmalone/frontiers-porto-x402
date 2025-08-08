import { useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { hashTypedData } from 'viem'
import { readContract } from 'viem/actions';
import { PORTO_ABI } from './abi';
import { SequenceDiagram } from './SequenceDiagram';
import { SERVER_URL } from './constants';
import { Json } from 'ox'

interface WeatherData {
  price: string;
  weather: string;
  temperature: string;
  futureDate: string;
}

interface PaymentRequest {
  prepareCalls: string;
}

/**
 * A component that handles premium weather data purchases through signed transactions
 */
export const PurchaseButtonSelf = () => {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successData, setSuccessData] = useState<WeatherData | null>(null);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);

  const handlePurchase = async () => {
    setIsProcessing(true);
    setIsSuccess(false);
    setSuccessData(null);

    try {
      // Initial request for weather data
      const initialResponse = await fetch(`${SERVER_URL}/api/self/weather`, {
        headers: {
          'X-USER-ADDRESS': address as `0x${string}`
        }
      });

      if (initialResponse.ok) {
        const weatherData = await initialResponse.json();
        setIsSuccess(true);
        setSuccessData(weatherData);
        return;
      }

      // Handle payment required scenario
      if (initialResponse.status === 402) {
        await handlePaymentRequired(initialResponse);
      } else {
        throw new Error(`Failed to fetch weather data: ${initialResponse.status} ${initialResponse.statusText}`);
      }
    } catch (error) {
      console.error('Purchase failed:', error);
      // In a production app, you might want to show this error to the user
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaymentRequired = async (paymentResponse: Response) => {
    if (!walletClient) {
      throw new Error('Wallet client not available');
    }

    // Verify super admin key exists
    const superAdminKey = await readContract(walletClient, {
      address: address as `0x${string}`,
      abi: PORTO_ABI,
      functionName: 'keyAt',
      args: [BigInt(0)],
    });

    if (!superAdminKey) {
      throw new Error('Super admin key not found');
    }

    // Parse payment request data
    const paymentRequestData: PaymentRequest = await paymentResponse.json();
    const prepareCalls = Json.parse(paymentRequestData.prepareCalls);
    const typedData = prepareCalls.typedData;
    
    // Verify typed data integrity
    const typedDataHash = hashTypedData(typedData);
    const recomputedTypedDataHash = hashTypedData(typedData);
    
    if (recomputedTypedDataHash !== typedDataHash) {
      throw new Error('Typed data hash mismatch - payment data may have been tampered with');
    }

    // Sign the payment intent
    const signature = await walletClient.signTypedData({
      account: address as `0x${string}`,
      ...typedData,
    }) as `0x${string}`;

    // Complete payment and retrieve weather data
    const paymentResponse2 = await fetch(`${SERVER_URL}/api/self/weather`, {
      headers: {
        'X-PAYMENT': signature,
        'X-USER-ADDRESS': address as `0x${string}`
      }
    });

    if (paymentResponse2.ok) {
      const weatherData = await paymentResponse2.json();
      setIsSuccess(true);
      setSuccessData(weatherData);
    } else {
      throw new Error(`Payment processing failed: ${paymentResponse2.status} ${paymentResponse2.statusText}`);
    }
  };

  return (
    <div className="component-container">
      <div className="button-group">
        <button
          onClick={handlePurchase}
          disabled={isProcessing || !address}
          className="primary-button"
        >
          {isProcessing ? 'Processing...' : 'Pay'}
        </button>

        {isSuccess && successData && (
          <div className="success-message">
            ✅ ${successData.price} purchase complete
            <div style={{ marginTop: '12px', fontSize: '14px', lineHeight: '1.4' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Weather Forecast:</div>
              <div>🌤️ <strong>Weather:</strong> {successData.weather}</div>
              <div>🌡️ <strong>Temperature:</strong> {successData.temperature}°F</div>
              <div>📅 <strong>Date:</strong> {successData.futureDate}</div>
            </div>
          </div>
        )}

        {!address && (
          <p className="helper-text">
            Please connect your Porto wallet first
          </p>
        )}

        <div className="collapsible-info">
          <button
            onClick={() => setIsInfoExpanded(!isInfoExpanded)}
            className="info-toggle-button"
          >
            {isInfoExpanded ? '▼' : '▶'} Explanation
          </button>

          <div className={`info-section ${isInfoExpanded ? 'expanded' : 'collapsed'}`}>
            <p>
              User/Agent can pay for paywalled content by signing an intent to pay the merchant X amount for the content.
              The merchant sends the final payment transaction onchain before returning the paywalled content.
            </p>
            <PurchaseSequenceDiagram />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Sequence diagram showing the purchase flow
 */
const PurchaseSequenceDiagram = () => {
  const diagramDefinition = `
    sequenceDiagram
      participant User
      participant Server
      
      User->>Server: Request Paywalled Content (1 click)
      Server->>Server: Checks for non-existent X-PAYMENT header.
      Server->>Server: Compute intent and quote for user to sign.
      Server->>User: Returns: Status Code: 402, Intent and Quote
      User->>User: Sign Intent (2 clicks)
      User->>Server: Retries retrieving paywalled content (X-PAYMENT set to signed intent signature.)
      Server->>Server: Verify signature matches expected intent and quote.
      Server->>Server: Execute payment.
      Server->>User: Returns: Status Code: 200, Paywalled Content
      User->>User: Displays Content
  `;

  return (
    <SequenceDiagram
      title="Self Authorize Payment"
      diagramDefinition={diagramDefinition}
      idPrefix="payment"
    />
  );
};

export default PurchaseButtonSelf;