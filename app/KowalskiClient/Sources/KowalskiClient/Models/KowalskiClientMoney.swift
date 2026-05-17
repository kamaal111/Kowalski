//
//  KowalskiClientMoney.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 12/20/25.
//

import KowalskiModels

public struct KowalskiClientMoney: Codable, Sendable {
    public let currency: KowalskiCurrency
    public let value: Double

    public init(currency: KowalskiCurrency, value: Double) {
        self.currency = currency
        self.value = value
    }
}
