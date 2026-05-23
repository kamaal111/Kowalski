//
//  PortfolioValueFormatting.swift
//  KowalskiFeatures
//
//  Created by OpenAI Codex on 5/23/26.
//

import KowalskiModels

enum PortfolioValueFormatting {
    static func signedCurrency(value: Double, currency: KowalskiCurrency) -> String {
        let formattedValue = abs(value).formatted(.currency(code: currency.rawValue))

        return "\(sign(for: value))\(formattedValue)"
    }

    static func signedPercent(_ value: Double) -> String {
        let formattedValue = (abs(value) / 100).formatted(.percent.precision(.fractionLength(0 ... 1)))

        return "\(sign(for: value))\(formattedValue)"
    }

    static func percent(_ value: Double) -> String {
        (value / 100).formatted(.percent.precision(.fractionLength(0 ... 1)))
    }

    private static func sign(for value: Double) -> String {
        if value > 0 {
            "+"
        } else if value < 0 {
            "-"
        } else {
            ""
        }
    }
}
