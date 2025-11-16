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
}
