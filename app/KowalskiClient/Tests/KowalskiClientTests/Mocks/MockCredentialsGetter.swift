//
//  MockCredentialsGetter.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 12/15/25.
//

@testable import KowalskiClient

struct MockCredentialsGetter: CredentialsGetter {
    let credentials: Credentials?

    func get() -> Credentials? {
        credentials
    }
}
