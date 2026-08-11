//
//  KowalskiAuthMapper.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 11/16/25.
//

struct KowalskiAuthMapper {
    /// Takes the parts rather than one generated type, since the preference overlay is a distinct
    /// anonymous type per operation.
    func mapSessionResponse(
        _ response: Components.Schemas.SessionResponse,
        preferredCurrency: Components.Schemas.Currency,
        hasPreferredCurrencyPreference: Bool,
    ) -> KowalskiAuthSessionResponse {
        KowalskiAuthSessionResponse(
            name: response.user.name,
            email: response.user.email,
            expiresAt: response.session.expiresAt,
            preferredCurrency: preferredCurrency.kowalskiCurrency,
            hasPreferredCurrencyPreference: hasPreferredCurrencyPreference,
        )
    }
}
