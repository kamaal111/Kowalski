//
//  LoggedInSession.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 10/5/25.
//

import Foundation

public struct LoggedInSession: Hashable, Codable {
    public let name: String
    public let expiresAt: Date
}
