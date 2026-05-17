//
//  KowalskiCurrencyMapperTests.swift
//  KowalskiClient
//
//  Created by OpenAI Codex on 5/23/26.
//

@testable import KowalskiClient
import KowalskiModels
import Testing

@Suite("Currency Mapper Tests")
struct KowalskiCurrencyMapperTests {
    @Test
    func `Generated currencies should map explicitly to app currencies`() {
        let mappedCurrencies = Components.Schemas.Currency.allCases.map(\.kowalskiCurrency)

        #expect(mappedCurrencies == KowalskiCurrency.allCases)
    }

    @Test
    func `App currencies should map explicitly to generated currencies`() {
        let generatedCurrencies = KowalskiCurrency.allCases.map(Components.Schemas.Currency.init)

        #expect(generatedCurrencies == Components.Schemas.Currency.allCases)
    }
}
