//
//  KowalskiPortfolioTransactionDetailScreen.swift
//  KowalskiFeatures
//
//  Created by OpenAI Codex on 4/3/26.
//

import KowalskiDesignSystem
import SwiftUI

struct KowalskiPortfolioTransactionDetailScreen: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(KowalskiPortfolio.self) private var portfolio

    @State private var entry: PortfolioEntry
    @State private var isEditing = false
    @State private var toast: Toast?

    private let onPairedTransaction: (_ entry: PortfolioEntry, _ type: TransactionType) -> Void

    init(
        entry: PortfolioEntry,
        onPairedTransaction: @escaping (_ entry: PortfolioEntry, _ type: TransactionType) -> Void,
    ) {
        _entry = State(initialValue: entry)
        self.onPairedTransaction = onPairedTransaction
    }

    var body: some View {
        Group {
            if isEditing {
                editView
            } else {
                detailView
            }
        }
        .frame(minSize: ModuleConfig.screenMinSize)
        .navigationTitle(isEditing ? "Edit Transaction" : "Transaction Details")
        .toolbar {
            ToolbarItemGroup(placement: .automatic) {
                if !isEditing {
                    ForEach(entry.transactionType.pairedActions, id: \.transactionType) { action in
                        Button(action.title) {
                            onPairedTransaction(entry, action.transactionType)
                        }
                    }
                }
                Button(isEditing ? "Cancel" : "Edit") {
                    isEditing.toggle()
                }
            }
        }
        .toastView(toast: $toast)
    }

    private var detailView: some View {
        List {
            Section("Stock") {
                KowalskiDetailsRow(detailTitle: "Symbol", value: entry.stock.symbol)
                KowalskiDetailsRow(detailTitle: "Name", value: entry.stock.name)
                KowalskiDetailsRow(detailTitle: "Exchange", value: entry.stock.exchangeDispatch ?? unavailableValue)
                KowalskiDetailsRow(detailTitle: "Exchange Code", value: entry.stock.exchange)
                KowalskiDetailsRow(detailTitle: "ISIN", value: entry.stock.isin ?? unavailableValue)
                KowalskiDetailsRow(detailTitle: "Sector", value: entry.stock.sector ?? unavailableValue)
                KowalskiDetailsRow(detailTitle: "Industry", value: entry.stock.industry ?? unavailableValue)
            }
            Section("Transaction") {
                KowalskiDetailsRow(detailTitle: "Type", value: entry.transactionType.label)
                KowalskiDetailsRow(detailTitle: "Amount", value: entry.amount.formatted(.number))
                KowalskiDetailsRow(
                    detailTitle: "Purchase Price",
                    value: purchasePriceValue,
                    valueAccessibilityIdentifier: purchasePriceAccessibilityIdentifier,
                )
                KowalskiDetailsRow(detailTitle: "Date", value: formatDate(entry.transactionDate))
            }
            Section("Audit") {
                KowalskiDetailsRow(
                    detailTitle: "Created",
                    value: formatDate(entry.createdAt),
                )
                KowalskiDetailsRow(
                    detailTitle: "Updated",
                    value: formatDate(entry.updatedAt),
                )
            }
        }
        .listStyle(.inset)
    }

    private var editView: some View {
        ScrollView {
            KowalskiPortfolioTransactionEditor(
                initialValues: .init(entry: entry),
                submitButtonTitle: "Save Changes",
                onSubmit: { payload in
                    await portfolio.updateTransaction(payload, entryId: entry.id)
                        .mapError { error in error as Error }
                },
                onFailure: { error in
                    toast = .error(message: error.localizedDescription)
                },
                onSuccess: { updatedEntry, _ in
                    entry = updatedEntry
                    isEditing = false
                },
            )
            .padding(.horizontal, .medium)
            .padding(.vertical, .small)
        }
    }

    private var unavailableValue: String {
        NSLocalizedString("Unavailable", comment: "")
    }

    private var purchasePriceValue: String {
        guard portfolio.showsMoneyValues else { return PortfolioMoneyValuePrivacy.maskedPlaceholder }

        return "\(entry.purchasePrice.currency.rawValue) \(entry.purchasePrice.value.formatted(.number))"
    }

    private var purchasePriceAccessibilityIdentifier: String {
        portfolio.showsMoneyValues ? "" : PortfolioMoneyValuePrivacy.accessibilityIdentifier
    }

    private func formatDate(_ date: Date) -> String {
        date.formatted(.dateTime.year().month().day().hour().minute())
    }
}

#Preview("Transaction detail") {
    NavigationStack {
        KowalskiPortfolioTransactionDetailScreen(
            entry: PortfolioEntry(
                id: UUID(uuidString: "cd81dbd7-3efa-42b3-8127-c1589279542f")!.uuidString,
                createdAt: Date(timeIntervalSince1970: 1_766_246_840),
                updatedAt: Date(timeIntervalSince1970: 1_766_246_840),
                stock: Stock(
                    symbol: "AAPL",
                    exchange: "NMS",
                    name: "Apple Inc.",
                    isin: "US0378331005",
                    sector: "Technology",
                    industry: "Consumer Electronics",
                    exchangeDispatch: "NASDAQ",
                ),
                amount: 10,
                purchasePrice: Money(currency: .USD, value: 150.5),
                preferredCurrencyPurchasePrice: Money(currency: .USD, value: 150.5),
                transactionType: .purchase,
                transactionDate: Date(timeIntervalSince1970: 1_766_246_840),
            ),
            onPairedTransaction: { _, _ in },
        )
    }
    .preview()
}
