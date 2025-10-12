//
//  Credentials.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 10/11/25.
//

import Foundation

struct Credentials: Codable {
    let email: String
    let password: String
    let authToken: String
    let expiry: Int

    var isExpired: Bool {
        Int(Date.now.timeIntervalSince1970) > expiry
    }
}
