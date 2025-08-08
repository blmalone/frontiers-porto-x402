import { CopyButton } from './CopyButton'

export function AccountDisplay({
    userAddress,
    serverAddress,
    sessionExpiry,
}: {
    userAddress: string
    serverAddress: string
    sessionExpiry: string
}) {
    function truncateAddress(address: string): string {
        if (!address || address.length < 10) return address
        return `${address.slice(0, 6)}...${address.slice(-4)}`
    }

    return (
        <div className="account-display">
            <div className="account-info">
                <h4 className="section-heading">Account Information</h4>

                <div className="info-row">
                    <span className="label">Address:</span>
                    <div className="address-container">
                        <a
                            href={`https://sepolia.basescan.org/address/${userAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="value-link"
                        >
                            {truncateAddress(userAddress)}
                        </a>
                        <CopyButton text={userAddress} />
                    </div>
                </div>

                <div className="info-row">
                    <span className="label">Server Address:</span>
                    <div className="address-container">
                        <a href={`https://sepolia.basescan.org/address/${serverAddress}`} target="_blank" rel="noopener noreferrer" className="value-link">
                            {truncateAddress(serverAddress)}
                        </a>
                        <CopyButton text={serverAddress} />
                    </div>
                </div>

                <div className="info-row">
                    <span className="label">Session Expiry:</span>
                    <div className="value-container">
                        <span className="value-text">{sessionExpiry}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}