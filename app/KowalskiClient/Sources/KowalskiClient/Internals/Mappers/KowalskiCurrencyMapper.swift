//
//  KowalskiCurrencyMapper.swift
//  KowalskiClient
//
//  Created by OpenAI Codex on 5/23/26.
//

import KowalskiModels

extension Components.Schemas.Currency {
    init(_ currency: KowalskiCurrency) {
        guard let generatedCurrency = Self(rawValue: currency.rawValue) else {
            preconditionFailure("Unsupported currency: \(currency.rawValue)")
        }

        self = generatedCurrency
    }

    var kowalskiCurrency: KowalskiCurrency {
        guard let currency = KowalskiCurrency(rawValue: rawValue) else {
            preconditionFailure("Unsupported generated currency: \(rawValue)")
        }

        return currency
    }
}

extension Components.Schemas.SessionResponse.UserPayload.PreferredCurrencyPayload {
    var kowalskiCurrency: KowalskiCurrency? {
        value1?.kowalskiCurrency
    }
}
