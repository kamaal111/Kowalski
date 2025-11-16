//
//  Credentials.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 10/11/25.
//

import Foundation
import KowalskiUtils

struct Credentials: Codable, Expirable {
    let email: String
    let authToken: String
    let expiryDate: Date

    var expiresAt: Date { expiryDate }

    func setExpiryDate(_ date: Date) -> Credentials {
        Credentials(email: email, authToken: authToken, expiryDate: date)
    }
}
