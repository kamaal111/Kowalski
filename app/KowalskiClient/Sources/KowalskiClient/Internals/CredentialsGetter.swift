//
//  CredentialsGetter.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 10/11/25.
//

import Foundation
import KamaalUtils

protocol CredentialsGetter: Sendable {
    func get() -> Credentials?
}

struct CredentialsGetterFactory {
    private init() { }

    static func `default`(keychainKey: String) -> CredentialsGetter {
        CredentialsGetterImpl(keychainKey: keychainKey)
    }

    static func preview(withCredentials: Bool) -> CredentialsGetter {
        let oneDay: TimeInterval = 86400
        let credentials: Credentials? = if withCredentials {
            Credentials(
                email: "yami@bulls.io",
                authToken: "GGGGGGGG",
                expiryDate: Date.now.addingTimeInterval(oneDay)
            )
        } else {
            nil
        }

        return CredentialsGetterPreview(crendentials: credentials)
    }
}

struct CredentialsGetterImpl: CredentialsGetter {
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

struct CredentialsGetterPreview: CredentialsGetter {
    let credentials: Credentials?

    init(crendentials: Credentials?) {
        self.credentials = crendentials
    }

    func get() -> Credentials? {
        credentials
    }
}
