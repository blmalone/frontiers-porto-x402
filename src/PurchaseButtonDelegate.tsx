import { useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { waitForCallsStatus } from 'viem/actions';
import { WalletActions } from 'porto/viem';
import { SequenceDiagram } from './SequenceDiagram';
import { SERVER_URL } from './constants';

interface WeatherData {
  price?: string;
  weather: string;
  temperature: string;
  futureDate: string;
}

interface PaymentResponse {
  accepts: {
    asset: string;
    payTo: string;
    maxAmountRequired: string;
  };
}

interface CallsStatus {
  statusCode: number;
}

/**
 * A component that handles delegated payment purchases where the merchant server
 * can execute payments on behalf of the user after permissions are granted
 */
export const PurchaseButtonDelegate = () => {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successData, setSuccessData] = useState<WeatherData | null>(null);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);

  const handleDelegatePurchase = async () => {
    setIsProcessing(true);
    setIsSuccess(false);
    setSuccessData(null);

    try {
      // Initial request for weather data
      const initialResponse = await fetch(`${SERVER_URL}/api/delegated/weather`, {
        credentials: 'include'
      });

      if (initialResponse.ok) {
        const weatherData = await initialResponse.json();
        setIsSuccess(true);
        setSuccessData(weatherData);
        return;
      }

      // Handle payment required scenario
      if (initialResponse.status === 402) {
        await handleDelegatedPayment(initialResponse);
      } else {
        throw new Error(`Failed to fetch weather data: ${initialResponse.status} ${initialResponse.statusText}`);
      }
    } catch (error) {
      console.error('Delegated purchase failed:', error);
      // In a production app, you might want to show this error to the user
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelegatedPayment = async (paymentResponse: Response) => {
    if (!walletClient) {
      throw new Error('Wallet client not available');
    }

    // Parse payment requirements
    const paymentData: PaymentResponse = await paymentResponse.json();
    const { asset: token, payTo: serverAddress, maxAmountRequired: limit } = paymentData.accepts;

    // Grant permissions to merchant server
    await WalletActions.grantPermissions(walletClient as any, {
      expiry: Math.floor(Date.now() / 1_000) + 60, // 60 seconds
      key: {
        publicKey: serverAddress as `0x${string}`,
        type: "secp256k1"
      },
      permissions: {
        calls: [{
          signature: 'transfer(address,uint256)',
          to: token as `0x${string}`
        }],
        spend: [{
          limit: BigInt(limit),
          period: 'minute',
          token: token as `0x${string}`,
        }]
      }
    });

    // Execute no-op transaction to force preCalls from wallet_grantPermissions onchain
    const { id } = await (walletClient as any).request({
      method: 'wallet_sendCalls',
      params: [{ calls: [] }] // Empty calls array  
    });

    // Wait for transaction confirmation
    const callsStatus = await waitForCallsStatus(walletClient as any, {
      id,
      status: (status: CallsStatus) => status.statusCode === 200,
      timeout: 20_000,
    });

    if (callsStatus.statusCode !== 200) {
      throw new Error(`Transaction failed with status: ${callsStatus.statusCode}`);
    }

    // Retrieve weather data after successful payment setup
    const finalResponse = await fetch(`${SERVER_URL}/api/delegated/weather`, {
      headers: {
        'X-PAYMENT': "Cookie proves we are who we say we are."
      },
      credentials: 'include'
    });

    if (finalResponse.ok) {
      const weatherData = await finalResponse.json();
      setIsSuccess(true);
      setSuccessData(weatherData);
    } else {
      throw new Error(`Payment processing failed: ${finalResponse.status} ${finalResponse.statusText}`);
    }
  };

  return (
    <div className="component-container">
      <div className="button-group">
        <button
          onClick={handleDelegatePurchase}
          disabled={isProcessing || !address}
          className="primary-button"
        >
          {isProcessing ? 'Processing...' : 'Pay via Server'}
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
              This allows the merchant server to execute payments on behalf of your Porto Account.
              It works by granting permissions to the merchant server's address.
              A potential timing attack, where an adversary calls the paywalled content API before the actual user after permissions are granted, is mitigated by requiring the API to authenticate the user using their JWT token.
            </p>
            <DelegateSequenceDiagram />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * A component that handles revoking all merchant permissions from the user's wallet
 */
export const RevokePermissionsButton = () => {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [isRevoking, setIsRevoking] = useState(false);
  const [isRevoked, setIsRevoked] = useState(false);

  const handleRevokePermissions = async () => {
    setIsRevoking(true);
    setIsRevoked(false);

    try {
      if (!walletClient) {
        throw new Error('Wallet client not available');
      }

      // Get all current permissions
      const permissions = await WalletActions.getPermissions(walletClient as any, {
        address: address as `0x${string}`,
      });

      // Revoke all permissions
      for (const permission of permissions) {
        await WalletActions.revokePermissions(walletClient as any, {
          address: address as `0x${string}`,
          id: permission.id as `0x${string}`,
        });
      }

      setIsRevoked(true);
    } catch (error) {
      console.error('Failed to revoke permissions:', error);
      // In a production app, you might want to show this error to the user
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="component-container">
      <div className="button-group">
        <button
          onClick={handleRevokePermissions}
          disabled={isRevoking || !address}
          className="disconnect-button"
          style={{ width: '200px', maxWidth: '280px' }}
        >
          {isRevoking ? 'Revoking...' : 'Revoke Permissions'}
        </button>

        {isRevoked && (
          <div className="success-message">
            ✅ All merchant permissions have been revoked successfully.
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

/**
 * Sequence diagram showing the delegated payment flow
 */
const DelegateSequenceDiagram = () => {
  const diagramDefinition = `
    sequenceDiagram
      participant User
      participant Server
      
      User->>Server: Request Paywalled Content (1 click)
      Server->>Server: Tries to pull payment from user's wallet and fails.
      Server->>User: Returns: Status Code: 402, Content Price, Receipt/Merchant Server Address, ERC20 Token Address
      User->>User: Grants Permissions to Merchant Server Address (2 clicks)
      User->>User: No-op onchain transaction to force preCalls from wallet_grantPermissions onchain (2 clicks)
      User->>Server: Retries retrieving paywalled content (X-PAYMENT set to JWT token from SIWE - prevents anyone else from accessing prepaid content.)
      Server->>User: Returns: Status Code: 200, Paywalled Content
      User->>User: Displays Content
  `;

  return (
    <SequenceDiagram
      title="Merchant Server Pulling Payment"
      diagramDefinition={diagramDefinition}
      idPrefix="delegate"
    />
  );
};

export default PurchaseButtonDelegate;