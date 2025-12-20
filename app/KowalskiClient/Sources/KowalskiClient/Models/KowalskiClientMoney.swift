//
//  KowalskiClientMoney.swift
//  KowalskiClient
//
//  Created by Kamaal M Farah on 12/20/25.
//

public struct KowalskiClientMoney: Codable, Sendable {
    public let currency: String
    public let value: Double

    public init(currency: String, value: Double) {
        self.currency = currency
        self.value = value
    }
}
