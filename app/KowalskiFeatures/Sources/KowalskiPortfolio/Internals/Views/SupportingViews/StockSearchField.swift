//
//  StockSearchField.swift
//  KowalskiFeatures
//

import KowalskiDesignSystem
import SwiftUI

struct StockSearchField: View {
    @Environment(KowalskiPortfolio.self) private var portfolio

    @Binding var selectedStock: Stock?

    let isEnabled: Bool

    var body: some View {
        KowalskiSearchableDropdown(
            selectedItem: $selectedStock,
            localizedTitle: "Symbol or ISIN",
            itemLabel: stockSearchLabel,
            onSearch: { query in
                await portfolio.searchStocks(query: query)
            },
        )
        .disabled(!isEnabled)
    }

    private func stockSearchLabel(_ stock: Stock) -> String {
        let exchange = stock.exchangeDispatch ?? stock.exchange
        let isinLabel = if let isin = stock.isin {
            " [ISIN: \(isin)]"
        } else {
            ""
        }

        return "\(stock.symbol) - \(stock.name)\(isinLabel) (\(exchange))"
    }
}
