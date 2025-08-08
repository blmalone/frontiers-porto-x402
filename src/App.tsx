import './App.css';
import { PurchaseButtonSelf } from './PurchaseButtonSelf';
import { PurchaseButtonDelegate, RevokePermissionsButton } from './PurchaseButtonDelegate';
import { Hooks } from 'porto/wagmi';
import { useAccount, useConnectors, useDisconnect } from 'wagmi';
import { useState, useEffect } from 'react';
import { AccountDisplay } from './AccountDisplay';
import { SERVER_URL } from './constants';

interface UserSession {
  exp: string;
}

/**
 * Main application component that handles user authentication and displays payment options
 */
function App() {
  const MERCHANT_ADDRESS = '0x64574add22aa10ffff44f096a388bf1718896b8b';
  
  const { disconnect } = useDisconnect();
  const connect = Hooks.useConnect();
  const { address, isConnected } = useAccount();
  const [connector] = useConnectors();
  const [userSession, setUserSession] = useState<UserSession | null>(null);

  const handleConnect = async () => {
    connect.mutate({
      connector,
      signInWithEthereum: {
        authUrl: `${SERVER_URL}/siwe`,
      },
    });
  };

  const handleDisconnect = () => {
    disconnect();
  };

  useEffect(() => {
    if (isConnected) {
      fetchUserSession();
    } else {
      setUserSession(null);
    }
  }, [isConnected]);

  const fetchUserSession = async () => {
    try {
      const response = await fetch(`${SERVER_URL}/api/me`, { credentials: 'include' });
      const responseText = await response.text();
      const parsedData = JSON.parse(responseText);
      setUserSession(parsedData.user);
    } catch (error) {
      console.error('Error fetching user session:', error);
      setUserSession(null);
    }
  };

  const sessionExpiry = userSession?.exp 
    ? new Date(Number(userSession.exp) * 1000).toLocaleDateString() 
    : 'Unknown';

  return (
    <>
      {/* Brand Logo in top left */}
      <div className="brand-container">
        <div className="brand">
          <span className="emoji-logo">⛅</span>
          <h1 className="brand-title">Weather Foreseer</h1>
        </div>
      </div>

      {/* Power button in top right when connected */}
      {isConnected && (
        <div className="power-button-container">
          <button
            onClick={handleDisconnect}
            className="power-button connected"
            title="Disconnect"
          >
            ⏻
          </button>
        </div>
      )}

      <div className="main-content">
        <div className="header">
          <p><i>Get next year's weather forecast today!</i></p>
        </div>

        {!isConnected ? (
          <div className="card">
            <button
              onClick={handleConnect}
              disabled={connect.isPending}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                backgroundColor: connect.isPending ? '#ccc' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: connect.isPending ? 'not-allowed' : 'pointer',
                marginTop: '16px',
                minHeight: '40px',
                fontWeight: '500',
                transition: 'background-color 0.2s',
                fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif'
              }}
            >
              {connect.isPending ? 'Connecting...' : 'Sign in With Ethereum'}
            </button>
          </div>
        ) : (
          <div>
            <div className="profile">
              <AccountDisplay
                userAddress={address!}
                serverAddress={MERCHANT_ADDRESS}
                sessionExpiry={sessionExpiry}
              />
            </div>
            <PurchaseButtonSelf />
            <hr />
            <PurchaseButtonDelegate />
            <RevokePermissionsButton />
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        gap: '16px',
        alignItems: 'center'
      }}>
        <a
          href="https://x.com/blainemalone"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#666',
            textDecoration: 'none',
            transition: 'color 0.2s',
            display: 'flex',
            alignItems: 'center'
          }}
          onMouseOver={(e) => e.currentTarget.style.color = '#1da1f2'}
          onMouseOut={(e) => e.currentTarget.style.color = '#666'}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </a>
        <a
          href="https://github.com/blmalone/porto-paywall"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: '#666',
            textDecoration: 'none',
            transition: 'color 0.2s',
            display: 'flex',
            alignItems: 'center'
          }}
          onMouseOver={(e) => e.currentTarget.style.color = '#000'}
          onMouseOut={(e) => e.currentTarget.style.color = '#666'}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
        </a>
      </footer>
    </>
  );
}

export default App;
