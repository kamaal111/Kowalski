//
//  KowalskiFeatureDefaults.swift
//  KowalskiFeatures
//
//  Created by Copilot on 4/6/26.
//

import ForexKit
import KowalskiModels

public enum KowalskiFeatureDefaults {
    public static let fallbackCurrency: KowalskiCurrency = .USD
    public static let fallbackForexKitCurrency: Currencies = .USD
    public static let serverSupportedCurrencies = KowalskiCurrency.allCases
    public static let serverSupportedForexCurrencies = serverSupportedCurrencies
        .compactMap(forexCurrency(for:))

    public static func kowalskiCurrency(for currency: Currencies) -> KowalskiCurrency? {
        KowalskiCurrency(rawValue: currency.rawValue)
    }

    public static func forexCurrency(for currency: KowalskiCurrency) -> Currencies? {
        Currencies(rawValue: currency.rawValue)
    }
}
