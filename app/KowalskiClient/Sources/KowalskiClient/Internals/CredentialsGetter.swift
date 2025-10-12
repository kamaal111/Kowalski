//
//  CredentialsGetter.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 10/11/25.
//

import Foundation
import KamaalUtils

struct CredentialsGetter {
    let keychainKey: String

    private let jsonDecoder: JSONDecoder

    init(keychainKey: String) {
        self.keychainKey = keychainKey
        self.jsonDecoder = JSONDecoder()
    }

    func get() -> Credentials? {
        guard let rawCredentials = try? Keychain.get(forKey: keychainKey).get() else { return nil }
        guard let credentials = try? jsonDecoder.decode(Credentials.self, from: rawCredentials) else { return nil }

        return credentials
    }
}
