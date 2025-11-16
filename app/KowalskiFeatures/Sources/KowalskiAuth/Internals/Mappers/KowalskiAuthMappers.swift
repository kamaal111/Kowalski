//
//  KowalskiAuthMappers.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 11/16/25.
//

import KowalskiClient

struct KowalskiAuthMappers {
    func mapSessionResponse(_ response: KowalskiAuthSessionResponse) -> UserSession {
        UserSession(name: response.name, email: response.email, expiresAt: response.expiresAt)
    }
}
