//
//  Expirable.swift
//  KowalskiUtils
//
//  Created by Kamaal M Farah on 11/16/25.
//

import Foundation

public protocol Expirable {
    var expiresAt: Date { get }
}

extension Expirable {
    public var isExpired: Bool {
        Date.now >= expiresAt
    }

    /// Checks if the expirable will expire soon within the specified time interval
    /// - Parameter within: Time interval in seconds before expiry (default: 1 hour)
    /// - Returns: True if expiry is within the specified time interval
    public func willExpireSoon(within: TimeInterval = 3600) -> Bool {
        let expiryThreshold = Date.now.addingTimeInterval(within)
        return expiresAt <= expiryThreshold
    }
}
