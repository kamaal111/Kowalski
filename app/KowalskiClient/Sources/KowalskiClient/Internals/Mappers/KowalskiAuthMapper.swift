//
//  KowalskiAuthMapper.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 11/16/25.
//

struct KowalskiAuthMapper {
    func mapSessionResponse(_ response: Components.Schemas.SessionResponse) -> KowalskiAuthSessionResponse {
        KowalskiAuthSessionResponse(
            name: response.user.name,
            email: response.user.email,
            expiresAt: response.session.expiresAt,
            preferredCurrency: response.user.preferredCurrency,
        )
    }
}
