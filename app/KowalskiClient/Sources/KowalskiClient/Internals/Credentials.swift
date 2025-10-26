//
//  Credentials.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 10/11/25.
//

import Foundation

struct Credentials: Codable {
    let email: String
    let authToken: String
    let expiryDate: Date

    var isExpired: Bool {
        Date.now >= expiryDate
    }

    func setExpiryDate(_ date: Date) -> Credentials {
        Credentials(email: email, authToken: authToken, expiryDate: date)
    }
}
